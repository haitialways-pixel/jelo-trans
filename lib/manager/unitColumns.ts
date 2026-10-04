/** Physical-unit columns that exist on live public.vehicle_units. */
export const UNIT_FIELDS_CORE = 'label, year, license_plate, status, notes'

/** Extra registration fields — only select when the live table has them. */
export const UNIT_FIELDS_FULL =
  'label, year, make, model_name, vin, license_plate, registration_expires, status, notes'

export const UNIT_EMBED_CORE =
  'assigned_unit:assigned_unit_id (label, year, license_plate)'

export const UNIT_EMBED_FULL =
  'assigned_unit:assigned_unit_id (label, year, make, model_name, vin, license_plate, registration_expires, status, notes)'

export function isMissingUnitColumnError(message: string | undefined): boolean {
  if (!message) return false
  return /vehicle_units.*\b(make|model_name|vin|registration_expires)\b/i.test(message) ||
    /\b(make|model_name|vin|registration_expires)\b.*does not exist/i.test(message)
}

export function shouldRetryUnitSelect(message: string | undefined): boolean {
  if (!message) return false
  return isMissingUnitColumnError(message) || /does not exist|vehicle_units/i.test(message)
}
