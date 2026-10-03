'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, isAdminRole } from '@/lib/manager/auth'
import { sealTaxId, type TaxIdType } from '@/lib/manager/taxId'
import { staffDb } from '@/lib/manager/db'
import { sendBookingReceived } from '@/lib/email/sendBookingReceived'
import { sendLifecycleEmails } from '@/lib/manager/lifecycleEmails'
import { notifyDriverDispatch, dispatchDeliveryError } from '@/lib/manager/dispatch'
import type { Chauffeur, ManagerReservation } from '@/lib/manager/data'
import { loadCustomerVehicleName } from '@/lib/manager/vehicleName'
import { formatManagerUnitLabel } from '@/lib/fleet/unitDisplay'
import { isStripeConfigured } from '@/lib/stripe/server'
import { chargeBalance, createDepositForBooking, refundCollectedDeposit } from '@/lib/stripe/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { summarizePayment } from '@/lib/payments/summary'
import { notifyManagement } from '@/lib/chatbot/notify'
import { getSiteUrl } from '@/lib/site'

export type ActionResult = { ok: true; warning?: string; depositUrl?: string } | { ok: false; error: string }
export type CompleteSettlement = 'card' | 'cash'

export type AdvanceReservationOpts = {
  /** Required when stage is `complete`. Card charges Stripe; cash records paid without Stripe. */
  settlement?: CompleteSettlement
}


const VALID_STAGES = [
  'confirm',
  'dispatch',
  'arrive_pickup',
  'onboard',
  'arrive_dropoff',
  'complete',
  'cancel',
] as const
export type Stage = (typeof VALID_STAGES)[number]

/**
 * Mark the remaining balance paid in cash. Does not call Stripe and does not
 * change a deposit that was already collected.
 */
async function recordCashBalance(reservationId: string): Promise<ActionResult> {
  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Cannot record cash without database admin access.' }
  }

  const { data: r, error } = await admin
    .from('reservations')
    .select(
      'id, booking_number, payment_status, deposit_amount, deposit_paid_at, balance_amount, balance_paid_at, total_price, fare_subtotal, gratuity_percent, gratuity_amount',
    )
    .eq('id', reservationId)
    .single()
  if (error || !r) return { ok: false, error: 'Reservation not found' }

  const summary = summarizePayment({
    totalPrice: r.total_price,
    fareSubtotal: r.fare_subtotal,
    gratuityPercent: r.gratuity_percent,
    gratuityAmount: r.gratuity_amount,
    paymentStatus: r.payment_status,
    depositAmount: r.deposit_amount,
    balanceAmount: r.balance_amount,
    depositPaidAt: r.deposit_paid_at,
    balancePaidAt: r.balance_paid_at,
  })

  if (!r.balance_paid_at || r.payment_status !== 'paid') {
    const { error: updateError } = await admin
      .from('reservations')
      .update({
        payment_status: 'paid',
        balance_paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (updateError) return { ok: false, error: updateError.message }
  }

  if (summary.amountDue > 0) {
    const { error: payError } = await admin.from('payments').insert({
      reservation_id: r.id,
      amount: summary.amountDue,
      payment_method: 'Cash',
      status: 'succeeded',
    })
    if (payError) {
      console.warn('[recordCashBalance] payments insert skipped:', payError.message)
    }
  }

  return { ok: true }
}

/** Advance a reservation through its lifecycle (confirm → … → complete / cancel). */
export async function advanceReservation(
  id: string,
  stage: Stage,
  opts?: AdvanceReservationOpts,
): Promise<ActionResult> {
  try {
    await assertStaff() // layer 2 — re-verify on this independent entry point
    if (!VALID_STAGES.includes(stage)) return { ok: false, error: 'Invalid stage' }

    const supabase = await createClient()
    const admin = await staffDb()

    // Auto-assign vehicle if not yet assigned when confirming or dispatching
    if (stage === 'confirm' || stage === 'dispatch') {
      const { data: currentRes } = await admin
        .from('reservations')
        .select('assigned_unit_id, vehicle_id')
        .eq('id', id)
        .maybeSingle()

      if (currentRes && !currentRes.assigned_unit_id && currentRes.vehicle_id) {
        const { data: availUnit } = await admin
          .from('vehicle_units')
          .select('id')
          .eq('model_id', currentRes.vehicle_id)
          .eq('status', 'available')
          .order('label', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (availUnit) {
          await supabase.rpc('staff_assign_reservation', {
            p_reservation_id: id,
            p_unit_id: availUnit.id,
            p_chauffeur_name: '',
          })
        }
      }
    }

    // Settle the balance BEFORE the ride is marked complete. Completing requires an
    // explicit card or cash choice from the manager popup.
    let completePaymentMethod: 'Cash' | 'Card on file' | null = null
    if (stage === 'complete') {
      const settlement = opts?.settlement
      if (settlement !== 'card' && settlement !== 'cash') {
        return {
          ok: false,
          error: 'Choose how to collect the balance: charge the saved card, or cash received.',
        }
      }
      if (settlement === 'cash') {
        const cash = await recordCashBalance(id)
        if (!cash.ok) {
          return {
            ok: false,
            error: `Ride was not marked complete. Cash was not recorded: ${cash.error}`,
          }
        }
        completePaymentMethod = 'Cash'
      } else {
        if (!isStripeConfigured()) {
          return {
            ok: false,
            error: 'Ride was not marked complete. Stripe is not configured, so the balance cannot be charged.',
          }
        }
        const charge = await chargeBalance(id)
        if (!charge.ok) {
          return {
            ok: false,
            error: `Ride was not marked complete. Balance was not charged: ${charge.reason ?? 'the card charge did not succeed'}.`,
          }
        }
        completePaymentMethod = 'Card on file'
      }
    }

    // layer 3 — the RPC checks is_staff() again, writes the audit row, and RETURNS the row.
    const { data, error } = await supabase.rpc('staff_advance_reservation', {
      p_reservation_id: id,
      p_stage: stage,
    })
    if (error) return { ok: false, error: error.message }

    // We need `res` (the reservation row returned by the RPC) for emails. For
    // `complete`, settlement runs FIRST so the ride-complete email reflects the
    // paid state. Card → 'Card on file' after a successful charge; cash → 'Cash'.
    // We then re-fetch the reservation so the email isn't stale.
    let res = Array.isArray(data) ? data[0] : data

    if (stage === 'complete') {
      const { data: fresh } = await admin.from('reservations').select('*').eq('id', id).maybeSingle()
      if (fresh) res = fresh
    }

    // Best-effort notifications — one email per lifecycle stage.
    // Must NEVER block or fail the action.
    const { customerVehicleName, fleetClassName } = res
      ? await loadCustomerVehicleName(admin, res)
      : { customerVehicleName: null, fleetClassName: null }
    const vehicleName = customerVehicleName

    let chauffeurContact: Chauffeur | null = null
    if (res?.chauffeur_id) {
      const { data: c } = await admin.from('chauffeurs').select('*').eq('id', res.chauffeur_id).maybeSingle()
      chauffeurContact = c as Chauffeur | null
    } else if (res?.chauffeur_name) {
      const { data: c } = await admin
        .from('chauffeurs')
        .select('*')
        .eq('name', res.chauffeur_name)
        .maybeSingle()
      chauffeurContact = c as Chauffeur | null
    }

    revalidatePath('/manager')
    revalidatePath('/manager/reservations')
    revalidatePath(`/manager/reservations/${id}`)

    let warning: string | undefined
    let depositUrl: string | undefined
    let refundInfo: string | undefined

    if (stage === 'confirm' && res?.booking_number && !res.deposit_paid_at) {
      if (!isStripeConfigured()) {
        warning = 'Stripe is not configured, so the 25% deposit link was not created and no card was saved.'
      } else {
        try {
          await createDepositForBooking(res.booking_number)
          depositUrl = `${getSiteUrl()}/pay/${res.booking_number}`
          const { data: fresh } = await admin.from('reservations').select('*').eq('id', id).maybeSingle()
          if (fresh) res = fresh
        } catch (e) {
          warning = `The 25% deposit link was not created: ${e instanceof Error ? e.message : 'Stripe error'}.`
        }
      }
    }

    if (stage === 'cancel' && res?.id) {
      try {
        const refund = await refundCollectedDeposit(res.id, { depositPaidAt: res.deposit_paid_at })
        if (refund.outcome === 'refunded' || refund.outcome === 'kept') refundInfo = refund.message
        if (refund.outcome === 'error') warning = refund.message
      } catch (e) {
        warning = `Reservation cancelled, but the deposit was NOT refunded: ${e instanceof Error ? e.message : 'refund failed'}.`
      }
    }

    if (res) {
      try {
        const emailResult = await sendLifecycleEmails({
          stage,
          res: res as ManagerReservation,
          vehicleName,
          fleetClassName,
          chauffeurContact,
          depositPayUrl: depositUrl,
          refundInfo,
          completePaymentMethod,
        })
        if (!emailResult.sent) {
          const detail = emailResult.reason ?? 'unknown error'
          if (stage === 'confirm') {
            const link = depositUrl ? ` Deposit link: ${depositUrl}.` : ''
            warning = `Reservation confirmed, but email was not sent (${detail}).${link}`
          } else {
            console.warn('[advanceReservation] lifecycle email not sent:', { stage, detail })
          }
        }
      } catch (e) {
        console.error('[advanceReservation] lifecycle email failed:', e)
        if (stage === 'confirm') {
          const link = depositUrl ? ` Deposit link: ${depositUrl}.` : ''
          warning = `Reservation confirmed, but email was not sent.${link}`
        }
      }
    }

    if (depositUrl && !(warning && warning.includes(depositUrl))) {
      warning = warning ? `${warning} Deposit link: ${depositUrl}` : `Deposit link: ${depositUrl}`
    }

    return warning ? { ok: true, warning, depositUrl } : { ok: true, depositUrl }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Re-send the customer confirmation email without changing reservation status. */
export async function resendConfirmationEmail(id: string): Promise<ActionResult> {
  try {
    await assertStaff()
    const admin = await staffDb()

    const { data: res, error } = await admin
      .from('reservations')
      .select(
        '*, fleet:vehicle_id (name, type), assigned_unit:assigned_unit_id (label, year, make, model_name, vin, license_plate, registration_expires)',
      )
      .eq('id', id)
      .maybeSingle()
    if (error || !res) return { ok: false, error: 'Reservation not found' }

    if (res.status === 'pending') {
      return { ok: false, error: 'Use Confirm reservation first — that sends the initial confirmation email.' }
    }
    if (res.status === 'cancelled') {
      return { ok: false, error: 'Cannot resend confirmation for a cancelled reservation.' }
    }
    if (res.status === 'completed') {
      return { ok: false, error: 'This ride is completed — confirmation resend is not available.' }
    }

    const { customerVehicleName, fleetClassName } = await loadCustomerVehicleName(admin, res)
    const vehicleName = customerVehicleName

    let chauffeurContact: Chauffeur | null = null
    if (res.chauffeur_id) {
      const { data: c } = await admin.from('chauffeurs').select('*').eq('id', res.chauffeur_id).maybeSingle()
      chauffeurContact = c as Chauffeur | null
    } else if (res.chauffeur_name) {
      const { data: c } = await admin
        .from('chauffeurs')
        .select('*')
        .eq('name', res.chauffeur_name)
        .maybeSingle()
      chauffeurContact = c as Chauffeur | null
    }

    const emailResult = await sendLifecycleEmails({
      stage: 'confirm',
      res: res as unknown as ManagerReservation,
      vehicleName,
      fleetClassName,
      chauffeurContact,
    })

    if (!emailResult.sent) {
      return {
        ok: false,
        error: `Confirmation email failed: ${emailResult.reason ?? 'unknown error'}`,
      }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Resend failed' }
  }
}

/** Assign a physical vehicle unit and/or chauffeur to a reservation. */
export async function assignReservation(
  id: string,
  unitId: string | null,
  chauffeurName: string,
  chauffeurId: string | null = null,
  driverPay: number | null = null,
  sendDispatch = false,
): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { error } = await supabase.rpc('staff_assign_reservation', {
      p_reservation_id: id,
      p_unit_id: unitId,
      p_chauffeur_name: chauffeurName,
      p_chauffeur_id: chauffeurId,
      p_driver_pay: driverPay,
    })
    if (error) return { ok: false, error: error.message }

    if (sendDispatch) {
      const admin = await staffDb()
      const { data: res, error: loadError } = await admin
        .from('reservations')
        .select(
          '*, fleet:vehicle_id (name), assigned_unit:assigned_unit_id (label, year, make, model_name, vin, license_plate)',
        )
        .eq('id', id)
        .maybeSingle()
      if (loadError || !res) return { ok: false, error: 'Assignment saved, but reservation could not be reloaded for email' }

      let chauffeur: Chauffeur | null = null
      if (res.chauffeur_id) {
        const { data: c } = await admin.from('chauffeurs').select('*').eq('id', res.chauffeur_id).maybeSingle()
        chauffeur = c as Chauffeur | null
      } else if (res.chauffeur_name) {
        const { data: c } = await admin.from('chauffeurs').select('*').eq('name', res.chauffeur_name).maybeSingle()
        chauffeur = c as Chauffeur | null
      }

      if (!chauffeur?.email?.trim()) {
        return {
          ok: false,
          error:
            'Assignment saved, but no chauffeur email is on file. Select a driver from the list and add their email under Fleet → Manage Chauffeurs.',
        }
      }

      const dispatchResult = await notifyDriverDispatch({
        reservation: res as unknown as ManagerReservation,
        chauffeur,
        vehicleName: (res as { fleet?: { name?: string } }).fleet?.name ?? null,
        forceEmail: true,
      })
      const deliveryError = dispatchDeliveryError(dispatchResult)
      if (deliveryError) return { ok: false, error: `Assignment saved, but ${deliveryError}` }
    }

    revalidatePath('/manager')
    revalidatePath(`/manager/reservations/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Change a physical unit's operational status (available / maintenance / …). */
export async function setUnitStatus(unitId: string, status: string): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { error } = await supabase.rpc('staff_set_unit_status', {
      p_unit_id: unitId,
      p_status: status,
    })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Update fleet category pricing (base, per-mile, minimum, hourly charter). */
export async function updateFleetPricing(
  fleetId: string,
  basePrice: number,
  pricePerMile: number,
  minimumPrice: number,
  hourlyRate: number,
): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await staffDb()
    const { error } = await supabase
      .from('fleet')
      .update({
        base_price: basePrice,
        price_per_mile: pricePerMile,
        minimum_price: minimumPrice,
        hourly_rate: hourlyRate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fleetId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    revalidatePath('/book')
    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

export type VehicleUnitWrite = {
  year?: number | null
  make?: string | null
  modelName?: string | null
  licensePlate?: string | null
  vin?: string | null
  registrationExpires?: string | null
  label?: string | null
}

function unitWritePayload(input: VehicleUnitWrite) {
  const year = input.year && Number.isFinite(input.year) && input.year > 0 ? Math.trunc(input.year) : null
  const make = input.make?.trim() || null
  const modelName = input.modelName?.trim() || null
  const licensePlate = input.licensePlate?.trim() || null
  const vin = input.vin?.trim() || null
  const registrationExpires = input.registrationExpires?.trim() || null
  const label =
    formatManagerUnitLabel({
      year,
      make,
      model_name: modelName,
      license_plate: licensePlate,
      label: input.label,
    }) ||
    input.label?.trim() ||
    ''
  return { year, make, modelName, licensePlate, vin, registrationExpires, label }
}

/** Add a new physical vehicle unit to the inventory. */
export async function addVehicleUnit(
  modelId: string,
  label: string,
  year: number,
  licensePlate: string,
  extra?: Omit<VehicleUnitWrite, 'label' | 'year' | 'licensePlate'>,
): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const payload = unitWritePayload({
      label,
      year,
      licensePlate,
      make: extra?.make,
      modelName: extra?.modelName,
      vin: extra?.vin,
      registrationExpires: extra?.registrationExpires,
    })
    if (!payload.label) return { ok: false, error: 'Vehicle name/label is required' }
    const { error } = await supabase
      .from('vehicle_units')
      .insert({
        model_id: modelId,
        label: payload.label,
        year: payload.year,
        make: payload.make,
        model_name: payload.modelName,
        vin: payload.vin,
        license_plate: payload.licensePlate,
        registration_expires: payload.registrationExpires,
        status: 'available',
      })

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Update an existing physical vehicle unit's details (label, year, plate, VIN, expiration). */
export async function updateVehicleUnit(
  unitId: string,
  label: string,
  year: number,
  licensePlate: string,
  extra?: Omit<VehicleUnitWrite, 'label' | 'year' | 'licensePlate'>,
): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const payload = unitWritePayload({
      label,
      year,
      licensePlate,
      make: extra?.make,
      modelName: extra?.modelName,
      vin: extra?.vin,
      registrationExpires: extra?.registrationExpires,
    })
    if (!payload.label) return { ok: false, error: 'Vehicle name/label is required' }
    const { error } = await supabase
      .from('vehicle_units')
      .update({
        label: payload.label,
        year: payload.year,
        make: payload.make,
        model_name: payload.modelName,
        vin: payload.vin,
        license_plate: payload.licensePlate,
        registration_expires: payload.registrationExpires,
        updated_at: new Date().toISOString(),
      })
      .eq('id', unitId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Delete a physical vehicle unit. */
export async function deleteVehicleUnit(unitId: string): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('vehicle_units')
      .delete()
      .eq('id', unitId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Add a new vehicle class (catalog model) to the fleet. */
export async function createFleetModel(
  name: string,
  type: string,
  capacity: number,
  luggageCapacity: number,
  basePrice: number,
  pricePerMile: number,
  imageUrl: string,
  description: string,
  tier: string,
  hourlyRate?: number,
): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await staffDb()
    const charterRate =
      hourlyRate != null && Number.isFinite(hourlyRate) && hourlyRate > 0
        ? hourlyRate
        : basePrice
    const { error } = await supabase
      .from('fleet')
      .insert({
        name,
        type,
        capacity,
        luggage_capacity: luggageCapacity,
        base_price: basePrice,
        price_per_mile: pricePerMile,
        hourly_rate: charterRate,
        image_url: imageUrl || null,
        description: description || null,
        tier: tier || null,
        status: 'available',
      })

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    revalidatePath('/book')
    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Delete a vehicle class from the fleet. */
export async function deleteFleetModel(modelId: string): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('fleet')
      .delete()
      .eq('id', modelId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    revalidatePath('/book')
    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Create a reservation manually from the manager portal. */
export async function createManualReservation(input: {
  customerName: string
  customerEmail: string
  customerPhone: string
  pickupAddress: string
  dropoffAddress: string
  pickupTime: string
  vehicleId: string
  passengers: number
  luggage: number
  durationHours: number
  specialRequests?: string
  totalPrice: number
  distanceMiles?: number
  notifyCustomer?: boolean
}): Promise<ActionResult & { bookingNumber?: string }> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('staff_create_reservation', {
      p_customer_name: input.customerName,
      p_customer_email: input.customerEmail,
      p_customer_phone: input.customerPhone,
      p_pickup_address: input.pickupAddress,
      p_dropoff_address: input.dropoffAddress,
      p_pickup_time: input.pickupTime,
      p_vehicle_id: input.vehicleId,
      p_passengers: input.passengers,
      p_luggage: input.luggage,
      p_duration_hours: input.durationHours,
      p_special_requests: input.specialRequests ?? null,
      p_total_price: input.totalPrice,
      p_distance_miles: input.distanceMiles ?? null,
    })
    if (error) return { ok: false, error: error.message }

    const res = Array.isArray(data) ? data[0] : data
    const bookingNumber = res?.booking_number as string | undefined

    if (input.notifyCustomer !== false && res?.customer_email) {
      try {
        const admin = await staffDb()
        const { data: v } = await admin.from('fleet').select('name').eq('id', res.vehicle_id).maybeSingle()
        await sendBookingReceived({
          to: res.customer_email,
          customerName: res.customer_name,
          bookingNumber: bookingNumber!,
          pickupTime: res.pickup_time,
          pickupAddress: res.pickup_address,
          dropoffAddress: res.dropoff_address,
          vehicleName: v?.name,
          totalPrice: Number(res.total_price),
        })
      } catch (e) {
        console.error('[createManualReservation] customer email failed:', e)
      }
    }

    revalidatePath('/manager')
    revalidatePath('/manager/reservations')
    return { ok: true, bookingNumber }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Dispatch driver notifications without advancing lifecycle (re-send). */
export async function sendDriverDispatchNotification(
  id: string,
  assignment?: {
    unitId?: string | null
    chauffeurName?: string
    chauffeurId?: string | null
    driverPay?: number | null
  },
): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const admin = await staffDb()

    if (assignment) {
      const { error: assignError } = await supabase.rpc('staff_assign_reservation', {
        p_reservation_id: id,
        p_unit_id: assignment.unitId ?? null,
        p_chauffeur_name: assignment.chauffeurName ?? '',
        p_chauffeur_id: assignment.chauffeurId ?? null,
        p_driver_pay: assignment.driverPay ?? null,
      })
      if (assignError) return { ok: false, error: assignError.message }
    }

    const { data: res, error } = await admin
      .from('reservations')
      .select(
        '*, fleet:vehicle_id (name), assigned_unit:assigned_unit_id (label, year, make, model_name, vin, license_plate)',
      )
      .eq('id', id)
      .maybeSingle()
    if (error || !res) return { ok: false, error: 'Reservation not found' }

    let chauffeur: Chauffeur | null = null
    if (res.chauffeur_id) {
      const { data: c } = await admin.from('chauffeurs').select('*').eq('id', res.chauffeur_id).maybeSingle()
      chauffeur = c as Chauffeur | null
    } else if (res.chauffeur_name) {
      const { data: c } = await admin.from('chauffeurs').select('*').eq('name', res.chauffeur_name).maybeSingle()
      chauffeur = c as Chauffeur | null
    }

    if (!chauffeur) {
      return {
        ok: false,
        error: 'Select a chauffeur from the driver list (with an email on file) before dispatching.',
      }
    }

    const dispatchResult = await notifyDriverDispatch({
      reservation: res as unknown as ManagerReservation,
      chauffeur,
      vehicleName: (res as { fleet?: { name?: string } }).fleet?.name ?? null,
      forceEmail: true,
    })

    const deliveryError = dispatchDeliveryError(dispatchResult)
    if (deliveryError) return { ok: false, error: deliveryError }

    revalidatePath('/manager')
    revalidatePath(`/manager/reservations/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Dispatch failed' }
  }
}

export type ChauffeurUpsertInput = {
  id?: string
  name: string
  phone?: string
  email?: string
  notifyEmail?: boolean
  notifySms?: boolean
  status?: string
  driverLicenseId: string
  driverLicenseExpiresOn?: string
  is1099Contractor?: boolean
  legalName?: string
  taxIdType?: TaxIdType | ''
  taxId?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
}

/** Admin-only masked SSN lookup for the edit form; never used in chauffeur lists. */
export async function getChauffeurTaxLast4(id: string): Promise<{ ok: boolean; last4?: string }> {
  try {
    const staff = await assertStaff()
    if (!isAdminRole(staff.role)) return { ok: false }
    const { data, error } = await (await staffDb())
      .from('chauffeurs')
      .select('tax_id_last4')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return { ok: false }
    const last4 = typeof data.tax_id_last4 === 'string' ? data.tax_id_last4 : ''
    return last4 ? { ok: true, last4 } : { ok: false }
  } catch {
    return { ok: false }
  }
}

/** Add or update a chauffeur. Tax ID is admin-only and never written to audit_log. */
export async function upsertChauffeur(input: ChauffeurUpsertInput): Promise<ActionResult> {
  try {
    const staff = await assertStaff()
    const name = input.name.trim()
    const driverLicenseId = input.driverLicenseId.trim()
    if (!name) return { ok: false, error: 'Name is required' }
    if (!driverLicenseId) return { ok: false, error: 'Driver ID is required' }

    const row: Record<string, unknown> = {
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      notify_email: input.notifyEmail !== false,
      notify_sms: input.notifySms !== false,
      status: input.status?.trim() || 'available',
      driver_license_id: driverLicenseId,
      driver_license_expires_on: input.driverLicenseExpiresOn?.trim() || null,
      is_1099_contractor: Boolean(input.is1099Contractor),
      legal_name: input.legalName?.trim() || null,
      address_line1: input.addressLine1?.trim() || null,
      address_line2: input.addressLine2?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip: input.zip?.trim() || null,
    }

    if (isAdminRole(staff.role)) {
      const type = input.taxIdType === 'ein' || input.taxIdType === 'ssn' ? input.taxIdType : null
      row.tax_id_type = type
      const raw = input.taxId?.trim() ?? ''
      if (raw) {
        const sealed = await sealTaxId(raw)
        row.tax_id_last4 = sealed.last4 || null
        row.tax_id_encrypted = sealed.encrypted
      }
    }

    const supabase = await staffDb()
    if (input.id) {
      const { error } = await supabase.from('chauffeurs').update(row).eq('id', input.id)
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await supabase.from('chauffeurs').insert(row)
      if (error) return { ok: false, error: error.message }
    }

    revalidatePath('/manager/fleet')
    revalidatePath('/manager/reservations')
    revalidatePath('/manager/reports')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** @deprecated Use upsertChauffeur — Driver ID is required. */
export async function addChauffeur(
  name: string,
  phone: string,
  email: string = '',
  notifyEmail = true,
  notifySms = true,
  driverLicenseId = '',
): Promise<ActionResult> {
  return upsertChauffeur({
    name,
    phone,
    email,
    notifyEmail,
    notifySms,
    driverLicenseId,
  })
}

/** Delete a chauffeur. */
export async function deleteChauffeur(id: string): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('chauffeurs')
      .delete()
      .eq('id', id)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    revalidatePath('/manager/reservations')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}
