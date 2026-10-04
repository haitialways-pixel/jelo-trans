import { formatCustomerVehicleName, type PhysicalUnitFields } from '@/lib/fleet/unitDisplay'
import { isMissingUnitColumnError, UNIT_FIELDS_CORE, UNIT_FIELDS_FULL } from '@/lib/manager/unitColumns'
import type { SupabaseClient } from '@supabase/supabase-js'

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
    const hasCustomerFields =
      (Boolean(unit?.make?.trim()) && Boolean(unit?.model_name?.trim()) && Boolean(unit?.license_plate?.trim())) ||
      Boolean(unit?.label?.trim()) ||
      Boolean(unit?.license_plate?.trim())
    if (!hasCustomerFields) {
      const full = await admin
        .from('vehicle_units')
        .select(UNIT_FIELDS_FULL)
        .eq('id', res.assigned_unit_id)
        .maybeSingle()
      if (!full.error && full.data) {
        unit = full.data as unknown as PhysicalUnitFields
      } else if (full.error && isMissingUnitColumnError(full.error.message)) {
        const retry = await admin
          .from('vehicle_units')
          .select(UNIT_FIELDS_CORE)
          .eq('id', res.assigned_unit_id)
          .maybeSingle()
        if (!retry.error && retry.data) unit = retry.data as unknown as PhysicalUnitFields
      }
    }
  }

  const customer = formatCustomerVehicleName(unit, className)
  return {
    customerVehicleName: customer || className,
    fleetClassName: className,
  }
}
