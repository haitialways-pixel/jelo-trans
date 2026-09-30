import { formatCustomerVehicleName, type PhysicalUnitFields } from '@/lib/fleet/unitDisplay'
import type { SupabaseClient } from '@supabase/supabase-js'

const UNIT_FIELDS = 'make, model_name, license_plate, year, vin, label, registration_expires'

type ReservationVehicleSource = {
  vehicle_id?: string | null
  assigned_unit_id?: string | null
  fleet?: { name?: string } | null
  assigned_unit?: PhysicalUnitFields | null
}

export async function loadCustomerVehicleName(
  admin: SupabaseClient,
  res: ReservationVehicleSource,
): Promise<{ customerVehicleName: string | null; fleetClassName: string | null }> {
  let className = res.fleet?.name ?? null
  if (!className && res.vehicle_id) {
    const { data: v } = await admin.from('fleet').select('name').eq('id', res.vehicle_id).maybeSingle()
    className = v?.name ?? null
  }

  let unit: PhysicalUnitFields | null = res.assigned_unit ?? null
  if (res.assigned_unit_id) {
    const complete =
      Boolean(unit?.make?.trim()) && Boolean(unit?.model_name?.trim()) && Boolean(unit?.license_plate?.trim())
    if (!complete) {
      const { data } = await admin
        .from('vehicle_units')
        .select(UNIT_FIELDS)
        .eq('id', res.assigned_unit_id)
        .maybeSingle()
      if (data) unit = data as PhysicalUnitFields
    }
  }

  const customer = formatCustomerVehicleName(unit, className)
  return {
    customerVehicleName: customer || className,
    fleetClassName: className,
  }
}
