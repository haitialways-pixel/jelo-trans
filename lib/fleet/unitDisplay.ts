/** Physical-unit display helpers. Manager vs customer copy must stay distinct. */

export type PhysicalUnitFields = {
  label?: string | null
  year?: number | null
  make?: string | null
  model_name?: string | null
  vin?: string | null
  license_plate?: string | null
  registration_expires?: string | null
}

function trim(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function yearText(year: number | null | undefined): string {
  if (year == null) return ''
  const n = Number(year)
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(Math.trunc(n))
}

/** Florida registration date as YYYY-MM-DD, without timezone shift. */
export function formatRegistrationExpires(value: string | null | undefined): string {
  const raw = trim(value)
  if (!raw) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (!m) return raw
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[Number(m[2]) - 1]
  if (!month) return raw
  return `${month} ${Number(m[3])}, ${m[1]}`
}

/**
 * Manager assign-list label: year, make, model, tag.
 * Example: "2021 Chevrolet Suburban LT · FK12U"
 */
export function formatManagerUnitLabel(unit: PhysicalUnitFields | null | undefined): string {
  if (!unit) return ''
  const name = [yearText(unit.year), trim(unit.make), trim(unit.model_name)].filter(Boolean).join(' ')
  const tag = trim(unit.license_plate)
  if (name && tag) return `${name} · ${tag}`
  if (name) return name
  if (tag) return tag
  return trim(unit.label)
}

/**
 * Assign-control line: year/make/model/tag plus VIN and expiration when present.
 */
export function formatManagerAssignOption(unit: PhysicalUnitFields | null | undefined): string {
  const base = formatManagerUnitLabel(unit)
  if (!unit) return base
  const extra: string[] = []
  const vin = trim(unit.vin)
  if (vin) extra.push(`VIN ${vin}`)
  const exp = formatRegistrationExpires(unit.registration_expires)
  if (exp) extra.push(`exp ${exp}`)
  if (!base) return extra.join(' · ')
  if (extra.length === 0) return base
  return `${base} · ${extra.join(' · ')}`
}

/**
 * Customer email/SMS vehicle line.
 * Assigned unit: "Chevrolet Suburban LT, tag FK12U" (make, model, tag only).
 * No unit, or missing make/model/tag: the booked class name. Never invent a tag.
 */
export function formatCustomerVehicleName(
  unit: PhysicalUnitFields | null | undefined,
  className?: string | null,
): string {
  const make = trim(unit?.make)
  const model = trim(unit?.model_name)
  const tag = trim(unit?.license_plate)
  if (make && model && tag) return `${make} ${model}, tag ${tag}`
  return trim(className)
}

export function customerVehicleNameFromRow(res: {
  fleet?: { name?: string } | null
  assigned_unit?: PhysicalUnitFields | null
}): string {
  return formatCustomerVehicleName(res.assigned_unit, res.fleet?.name ?? '')
}
