'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/manager/auth'
import { sendChauffeurEnRoute } from '@/lib/email/sendChauffeurEnRoute'
import { sendArrivedAtPickup } from '@/lib/email/sendArrivedAtPickup'
import { sendPassengerOnBoard } from '@/lib/email/sendPassengerOnBoard'
import { sendArrivedAtDestination } from '@/lib/email/sendArrivedAtDestination'
import { sendRideComplete } from '@/lib/email/sendRideComplete'
import { sendCancellation } from '@/lib/email/sendCancellation'
import { isStripeConfigured } from '@/lib/stripe/server'
import { chargeBalance } from '@/lib/stripe/payments'
import { notifyManagement } from '@/lib/chatbot/notify'

export type ActionResult = { ok: true } | { ok: false; error: string }

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

    // Auto-assign vehicle if not yet assigned when confirming or dispatching
    if (stage === 'confirm' || stage === 'dispatch') {
      const { data: currentRes } = await supabase
        .from('reservations')
        .select('assigned_unit_id, vehicle_id')
        .eq('id', id)
        .maybeSingle()

      if (currentRes && !currentRes.assigned_unit_id && currentRes.vehicle_id) {
        const { data: availUnit } = await supabase
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
          const { data: fresh } = await supabase
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

    // Best-effort customer notifications — one email per lifecycle stage.
    // Must NEVER block or fail the action.
    if (res?.customer_email) {
      // Pull the vehicle name (joined from fleet) so emails can show "Premium Executive"
      // rather than a bare UUID. Best-effort — undefined if the join fails.
      let vehicleName: string | null = null
      if (res.vehicle_id) {
        const { data: v } = await supabase
          .from('fleet')
          .select('name')
          .eq('id', res.vehicle_id)
          .maybeSingle()
        vehicleName = v?.name ?? null
      }

      const common = {
        to: res.customer_email as string,
        customerName: res.customer_name as string,
        bookingNumber: res.booking_number as string,
        vehicleName,
        chauffeurName: res.chauffeur_name as string | null,
      }

      try {
        switch (stage) {
          case 'dispatch':
            await sendChauffeurEnRoute({
              ...common,
              pickupAddress: res.pickup_address,
              pickupTime: res.pickup_time,
            })
            break
          case 'arrive_pickup':
            await sendArrivedAtPickup(common)
            break
          case 'onboard':
            await sendPassengerOnBoard(common)
            break
          case 'arrive_dropoff':
            await sendArrivedAtDestination({
              to: common.to,
              customerName: common.customerName,
              bookingNumber: common.bookingNumber,
            })
            break
          case 'complete':
            await sendRideComplete({
              ...common,
              pickupAddress: res.pickup_address,
              dropoffAddress: res.dropoff_address,
              pickupTime: res.pickup_time,
              totalAmount: res.total_price != null ? Number(res.total_price) : null,
              transactionId: res.balance_intent_id ?? res.deposit_intent_id ?? null,
              paymentMethod: res.payment_status === 'paid' ? 'Card on file' : null,
              completedAt: res.completed_at ?? new Date().toISOString(),
            })
            break
          case 'cancel':
            await sendCancellation({
              to: common.to,
              customerName: common.customerName,
              bookingNumber: common.bookingNumber,
              cancellationReason: 'Cancelled by Phalo Transportation',
            })
            break
          // 'confirm' emits no email — the BookingConfirmedEmail is sent at booking creation.
        }
      } catch {
        // swallow — the lifecycle transition already succeeded and is audited.
      }
    }

    revalidatePath('/manager')
    revalidatePath('/manager/reservations')
    revalidatePath(`/manager/reservations/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Assign a physical vehicle unit and/or chauffeur to a reservation. */
export async function assignReservation(
  id: string,
  unitId: string | null,
  chauffeurName: string,
): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { error } = await supabase.rpc('staff_assign_reservation', {
      p_reservation_id: id,
      p_unit_id: unitId,
      p_chauffeur_name: chauffeurName,
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
    await assertStaff()
    const supabase = await createClient()
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
    await assertStaff()
    const supabase = await createClient()
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
    await assertStaff()
    const supabase = await createClient()
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
    await assertStaff()
    const supabase = await createClient()
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
    await assertStaff()
    const supabase = await createClient()
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
    await assertStaff()
    const supabase = await createClient()
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

/** Add a new chauffeur. */
export async function addChauffeur(name: string, phone: string): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { error } = await supabase
      .from('chauffeurs')
      .insert({ name, phone })

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
    await assertStaff()
    const supabase = await createClient()
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


