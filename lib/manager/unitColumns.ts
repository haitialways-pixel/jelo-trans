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

/** Worker-isolate cache: skip the failing full select after the first 42703. */
const UNIT_COLUMN_RECHECK_MS = 5 * 60 * 1000
let legacyUntil = 0

export function preferLegacyUnitColumns(): boolean {
  return legacyUntil > Date.now()
}

export function markUnitColumnsMissing(): void {
  legacyUntil = Date.now() + UNIT_COLUMN_RECHECK_MS
}

export function markUnitColumnsPresent(): void {
  legacyUntil = 0
}

export function reservationUnitEmbed(): string {
  return preferLegacyUnitColumns() ? UNIT_EMBED_CORE : UNIT_EMBED_FULL
}

export function unitFieldsSelect(): string {
  return preferLegacyUnitColumns() ? UNIT_FIELDS_CORE : UNIT_FIELDS_FULL
}
