import { staffDb } from '@/lib/manager/db'

export type ReportPreset = 'today' | 'week' | 'month' | 'year' | 'custom'
export type ReportStatus = 'all' | 'active' | 'completed' | 'cancelled'

export type ReportReservation = {
  id: string
  booking_number: string
  customer_name: string
  pickup_time: string
  pickup_address: string
  dropoff_address: string
  status: string
  payment_status: string
  total_price: number
  driver_pay: number | null
  duration_hours: number
  chauffeur_id: string | null
  chauffeur_name: string | null
  assigned_unit_id: string | null
  archived: boolean | null
  fleet: { name: string } | null
}

const REPORT_COLUMNS =
  'id, booking_number, customer_name, pickup_time, pickup_address, dropoff_address, status, payment_status, total_price, driver_pay, duration_hours, chauffeur_id, chauffeur_name, assigned_unit_id, archived, fleet:vehicle_id (name)'

const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function ymdInNy(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${y}-${m}-${day}`
}

function nyBoundaryIso(ymd: string, endOfDay: boolean): string {
  const probe = new Date(`${ymd}T12:00:00Z`)
  const offsetPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value
  const match = offsetPart?.match(/GMT([+-]\d+)(?::(\d+))?/)
  const hours = match ? Number(match[1]) : -4
  const mins = match?.[2] ? Number(match[2]) : 0
  const sign = hours <= 0 ? '-' : '+'
  const absH = Math.abs(hours)
  const tz = `${sign}${pad(absH)}:${pad(mins)}`
  return endOfDay ? `${ymd}T23:59:59.999${tz}` : `${ymd}T00:00:00.000${tz}`
}

export function resolveReportRange(opts: {
  preset: ReportPreset
  from?: string | null
  to?: string | null
}): { fromIso: string; toIso: string; fromYmd: string; toYmd: string } {
  const today = ymdInNy()
  let fromYmd = today
  let toYmd = today

  if (opts.preset === 'custom' && opts.from && opts.to) {
    fromYmd = opts.from
    toYmd = opts.to
  } else if (opts.preset === 'week') {
    const now = new Date()
    const nyNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day = nyNow.getDay()
    const start = new Date(nyNow)
    start.setDate(nyNow.getDate() - day)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    fromYmd = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
    toYmd = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
  } else if (opts.preset === 'month') {
    fromYmd = today.slice(0, 8) + '01'
    const [y, m] = today.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    toYmd = `${today.slice(0, 8)}${pad(last)}`
  } else if (opts.preset === 'year') {
    fromYmd = `${today.slice(0, 4)}-01-01`
    toYmd = `${today.slice(0, 4)}-12-31`
  }

  return {
    fromYmd,
    toYmd,
    fromIso: nyBoundaryIso(fromYmd, false),
    toIso: nyBoundaryIso(toYmd, true),
  }
}

export async function getReportReservations(opts: {
  fromIso: string
  toIso: string
  status: ReportStatus
  chauffeurId?: string | null
}): Promise<ReportReservation[]> {
  const supabase = await staffDb()
  let q = supabase
    .from('reservations')
    .select(REPORT_COLUMNS)
    .gte('pickup_time', opts.fromIso)
    .lte('pickup_time', opts.toIso)
    .or('archived.eq.false,archived.is.null')
    .order('pickup_time', { ascending: true })

  if (opts.status === 'completed') q = q.eq('status', 'completed')
  else if (opts.status === 'cancelled') q = q.eq('status', 'cancelled')
  else if (opts.status === 'active') q = q.in('status', ACTIVE_STATUSES)

  if (opts.chauffeurId) q = q.eq('chauffeur_id', opts.chauffeurId)

  const { data, error } = await q
  if (error) {
    let q2 = supabase
      .from('reservations')
      .select(
        'id, booking_number, customer_name, pickup_time, pickup_address, dropoff_address, status, payment_status, total_price, driver_pay, duration_hours, chauffeur_id, chauffeur_name, assigned_unit_id, fleet:vehicle_id (name)',
      )
      .gte('pickup_time', opts.fromIso)
      .lte('pickup_time', opts.toIso)
      .order('pickup_time', { ascending: true })
    if (opts.status === 'completed') q2 = q2.eq('status', 'completed')
    else if (opts.status === 'cancelled') q2 = q2.eq('status', 'cancelled')
    else if (opts.status === 'active') q2 = q2.in('status', ACTIVE_STATUSES)
    if (opts.chauffeurId) q2 = q2.eq('chauffeur_id', opts.chauffeurId)
    const retry = await q2
    if (retry.error) {
      console.error('[reports] getReportReservations:', error.message)
      return []
    }
    return (retry.data ?? []) as unknown as ReportReservation[]
  }
  return (data ?? []) as unknown as ReportReservation[]
}

export function reportKpis(rows: ReportReservation[]) {
  const rides = rows.length
  const completed = rows.filter((r) => r.status === 'completed')
  const cancelled = rows.filter((r) => r.status === 'cancelled')
  const revenue = completed.reduce((s, r) => s + Number(r.total_price || 0), 0)
  const unpaid = rows
    .filter((r) => r.status !== 'cancelled' && (r.payment_status === 'unpaid' || r.payment_status === 'partial'))
    .reduce((s, r) => s + Number(r.total_price || 0), 0)
  return {
    rides,
    completed: completed.length,
    cancelled: cancelled.length,
    revenue: Math.round(revenue * 100) / 100,
    unpaid: Math.round(unpaid * 100) / 100,
  }
}

export function needsAttention(rows: ReportReservation[], now = Date.now()): ReportReservation[] {
  const horizon = now + 24 * 60 * 60 * 1000
  return rows.filter((r) => {
    if (r.status === 'cancelled') return false
    const t = new Date(r.pickup_time).getTime()
    if (Number.isNaN(t) || t > horizon) return false
    const noUnit = !r.assigned_unit_id
    const noChauffeur = !r.chauffeur_id && !r.chauffeur_name
    const pending = r.status === 'pending'
    const unpaid = r.payment_status === 'unpaid' || r.payment_status === 'partial'
    return noUnit || noChauffeur || pending || unpaid
  })
}

export type DriverPayRow = {
  id: string
  pickup_time: string
  booking_number: string
  chauffeur_id: string | null
  chauffeur_name: string
  is_1099: boolean
  duration_hours: number
  driver_pay: number
  pay_not_entered: boolean
}

export function driverPayRows(
  rows: ReportReservation[],
  chauffeur1099: Map<string, boolean>,
): DriverPayRow[] {
  const jobs = rows.filter((r) => r.status === 'completed' && (r.chauffeur_id || r.chauffeur_name))
  const mapped: DriverPayRow[] = jobs.map((r) => {
    const payNotEntered = r.driver_pay == null
    return {
      id: r.id,
      pickup_time: r.pickup_time,
      booking_number: r.booking_number,
      chauffeur_id: r.chauffeur_id,
      chauffeur_name: r.chauffeur_name || 'Unnamed',
      is_1099: r.chauffeur_id ? Boolean(chauffeur1099.get(r.chauffeur_id)) : false,
      duration_hours: Number(r.duration_hours || 0),
      driver_pay: payNotEntered ? 0 : Number(r.driver_pay),
      pay_not_entered: payNotEntered,
    }
  })
  mapped.sort((a, b) => {
    const n = a.chauffeur_name.localeCompare(b.chauffeur_name)
    if (n !== 0) return n
    return a.pickup_time.localeCompare(b.pickup_time)
  })
  return mapped
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}
