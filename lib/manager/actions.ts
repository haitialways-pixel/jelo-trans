'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/manager/auth'
import { staffDb } from '@/lib/manager/db'
import { sendBookingReceived } from '@/lib/email/sendBookingReceived'
import { sendLifecycleEmails } from '@/lib/manager/lifecycleEmails'
import { notifyDriverDispatch, dispatchDeliveryError } from '@/lib/manager/dispatch'
import type { Chauffeur, ManagerReservation } from '@/lib/manager/data'
import { isStripeConfigured } from '@/lib/stripe/server'
import { chargeBalance } from '@/lib/stripe/payments'
import { notifyManagement } from '@/lib/chatbot/notify'

export type ActionResult = { ok: true; warning?: string } | { ok: false; error: string }

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

/** Advance a reservation through its lifecycle (confirm → … → complete / cancel). */
export async function advanceReservation(id: string, stage: Stage): Promise<ActionResult> {
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

    // layer 3 — the RPC checks is_staff() again, writes the audit row, and RETURNS the row.
    const { data, error } = await supabase.rpc('staff_advance_reservation', {
      p_reservation_id: id,
      p_stage: stage,
    })
    if (error) return { ok: false, error: error.message }

    // We need `res` (the reservation row returned by the RPC) for emails. Important
    // ordering note for `complete`: chargeBalance() runs FIRST so the ride-complete
    // email reflects the FINAL paid state (transaction id of the balance charge,
    // 'Card on file' payment method, fresh payment_status). We then re-fetch the
    // reservation so the email isn't stale.
    let res = Array.isArray(data) ? data[0] : data

    // Stripe: charge the remaining balance off-session when the ride completes.
    // Gated + best-effort: a decline never blocks completion — the manager is alerted.
    if (stage === 'complete' && isStripeConfigured()) {
      try {
        const charge = await chargeBalance(id)
        if (!charge.ok) {
          await notifyManagement({
            title: '⚠️ Balance not charged',
            message: `Reservation ${res?.booking_number ?? id} completed, but the balance charge failed: ${charge.reason}. Please follow up with the customer.`,
          })
        } else {
          // Re-fetch so the receipt email reads the post-charge state.
          const { data: fresh } = await admin
            .from('reservations')
            .select('*')
            .eq('id', id)
            .maybeSingle()
          if (fresh) res = fresh
        }
      } catch {
        // never block completion on a payment error
      }
    }

    // Best-effort notifications — one email per lifecycle stage.
    // Must NEVER block or fail the action.
    let vehicleName: string | null = null
    if (res?.vehicle_id) {
      const { data: v } = await admin
        .from('fleet')
        .select('name')
        .eq('id', res.vehicle_id)
        .maybeSingle()
      vehicleName = v?.name ?? null
    }

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
    if (res) {
      try {
        const emailResult = await sendLifecycleEmails({
          stage,
          res: res as ManagerReservation,
          vehicleName,
          chauffeurContact,
        })
        if (!emailResult.sent) {
          const detail = emailResult.reason ?? 'unknown error'
          if (stage === 'confirm') {
            warning = `Reservation confirmed, but customer email failed: ${detail}`
          } else {
            console.warn('[advanceReservation] lifecycle email not sent:', { stage, detail })
          }
        }
      } catch (e) {
        console.error('[advanceReservation] lifecycle email failed:', e)
        if (stage === 'confirm') {
          warning = 'Reservation confirmed, but confirmation email could not be sent.'
        }
      }
    }

    return warning ? { ok: true, warning } : { ok: true }
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
      .select('*, fleet:vehicle_id (name, type), assigned_unit:assigned_unit_id (label, year)')
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

    let vehicleName: string | null = (res as { fleet?: { name?: string } }).fleet?.name ?? null
    if (!vehicleName && res.vehicle_id) {
      const { data: v } = await admin.from('fleet').select('name').eq('id', res.vehicle_id).maybeSingle()
      vehicleName = v?.name ?? null
    }

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
): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { error } = await supabase.rpc('staff_assign_reservation', {
      p_reservation_id: id,
      p_unit_id: unitId,
      p_chauffeur_name: chauffeurName,
      p_chauffeur_id: chauffeurId,
    })
    if (error) return { ok: false, error: error.message }

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

/** Update fleet category pricing (base, per-mile, minimum). */
export async function updateFleetPricing(
  fleetId: string,
  basePrice: number,
  pricePerMile: number,
  minimumPrice: number,
): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('fleet')
      .update({
        base_price: basePrice,
        price_per_mile: pricePerMile,
        minimum_price: minimumPrice,
        updated_at: new Date().toISOString()
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

/** Add a new physical vehicle unit to the inventory. */
export async function addVehicleUnit(
  modelId: string,
  label: string,
  year: number,
  licensePlate: string,
): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('vehicle_units')
      .insert({
        model_id: modelId,
        label: label,
        year: year || null,
        license_plate: licensePlate || null,
        status: 'available',
      })

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Update an existing physical vehicle unit's details (label, year, plate). */
export async function updateVehicleUnit(
  unitId: string,
  label: string,
  year: number,
  licensePlate: string,
): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('vehicle_units')
      .update({
        label: label,
        year: year || null,
        license_plate: licensePlate || null,
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
  tier: string
): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('fleet')
      .insert({
        name,
        type,
        capacity,
        luggage_capacity: luggageCapacity,
        base_price: basePrice,
        price_per_mile: pricePerMile,
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
      })
      if (assignError) return { ok: false, error: assignError.message }
    }

    const { data: res, error } = await admin
      .from('reservations')
      .select(
        '*, fleet:vehicle_id (name), assigned_unit:assigned_unit_id (label)',
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

/** Add a new chauffeur. */
export async function addChauffeur(
  name: string,
  phone: string,
  email: string = '',
  notifyEmail = true,
  notifySms = true,
): Promise<ActionResult> {
  try {
    const supabase = await staffDb()
    const { error } = await supabase
      .from('chauffeurs')
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        notify_email: notifyEmail,
        notify_sms: notifySms,
      })

    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/fleet')
    revalidatePath('/manager/reservations')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
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


