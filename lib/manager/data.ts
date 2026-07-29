import { staffDb } from '@/lib/manager/db'
import { isBookingNumber, normalizeBookingNumber } from '@/lib/bookingNumber'

/** A reservation as seen by staff (full row + embedded vehicle name). */
export type ManagerReservation = {
  id: string
  booking_number: string
  customer_name: string
  customer_email: string
  customer_phone: string
  pickup_address: string
  dropoff_address: string
  pickup_time: string
  status: string
  payment_status: string
  deposit_amount: number | null
  balance_amount: number | null
  deposit_paid_at: string | null
  balance_paid_at: string | null
  total_price: number
  fare_subtotal: number | null
  gratuity_percent: number | null
  gratuity_amount: number | null
  passengers: number
  luggage: number
  duration_hours: number
  chauffeur_name: string | null
  chauffeur_id: string | null
  source: string
  vehicle_id: string | null
  dispatched_at: string | null
  arrived_pickup_at: string | null
  onboard_at: string | null
  arrived_dropoff_at: string | null
  completed_at: string | null
  special_requests: string | null
  created_at: string
  assigned_unit_id: string | null
  distance_miles: number | null
  deposit_intent_id: string | null
  balance_intent_id: string | null
  fleet: { name: string; type: string } | null
  assigned_unit: { label: string; year: number | null } | null
}

const RES_COLUMNS =
  'id, booking_number, customer_name, customer_email, customer_phone, pickup_address, dropoff_address, pickup_time, status, payment_status, deposit_amount, balance_amount, deposit_paid_at, balance_paid_at, total_price, fare_subtotal, gratuity_percent, gratuity_amount, passengers, luggage, duration_hours, chauffeur_name, chauffeur_id, source, vehicle_id, assigned_unit_id, dispatched_at, arrived_pickup_at, onboard_at, arrived_dropoff_at, completed_at, special_requests, created_at, distance_miles, deposit_intent_id, balance_intent_id, fleet:vehicle_id (name, type), assigned_unit:assigned_unit_id (label, year)'

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '')
}

function normalizePhoneSearch(term: string): string {
  return term.replace(/[^0-9+]/g, '')
}

/** Search by last name (customer name), phone, or booking number. */
export async function searchReservations(
  query: string,
  opts?: { status?: string; limit?: number },
): Promise<ManagerReservation[]> {
  const raw = query.trim()
  if (!raw) return getReservations(opts)

  const supabase = await staffDb()
  const safe = escapeIlike(raw)
  const upper = escapeIlike(normalizeBookingNumber(raw))
  const phone = normalizePhoneSearch(raw)

  const orParts: string[] = []

  if (isBookingNumber(raw)) {
    orParts.push(`booking_number.eq.${upper}`)
  } else if (/^PH/i.test(raw)) {
    orParts.push(`booking_number.ilike.%${upper}%`)
  }

  // Last name: match surname (after a space) or a single-word name.
  orParts.push(`customer_name.ilike.% ${safe}%`)
  orParts.push(`customer_name.ilike.% ${safe}`)
  orParts.push(`customer_name.eq.${safe}`)

  if (phone.length >= 4) {
    orParts.push(`customer_phone.ilike.%${phone}%`)
  }

  let q = supabase
    .from('reservations')
    .select(RES_COLUMNS)
    .or(orParts.join(','))
    .order('pickup_time', { ascending: true })

  if (opts?.status) q = q.eq('status', opts.status)
  if (opts?.limit) q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) {
    console.error('[manager] searchReservations:', error.message)
    return []
  }
  return (data ?? []) as unknown as ManagerReservation[]
}

/** All reservations (staff-gated server-side), soonest pickup first. */
export async function getReservations(opts?: {
  status?: string
  limit?: number
}): Promise<ManagerReservation[]> {
  const supabase = await staffDb()
  let q = supabase
    .from('reservations')
    .select(RES_COLUMNS)
    .order('pickup_time', { ascending: true })

  if (opts?.status) q = q.eq('status', opts.status)
  if (opts?.limit) q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) {
    console.error('[manager] getReservations:', error.message)
    return []
  }
  return (data ?? []) as unknown as ManagerReservation[]
}

/** A single reservation by id, or null if not found. */
export async function getReservation(id: string): Promise<ManagerReservation | null> {
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('reservations')
    .select(RES_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[manager] getReservation:', error.message)
    return null
  }
  return data as unknown as ManagerReservation
}

/** A physical vehicle unit (one real car) with its catalog model embedded. */
export type VehicleUnit = {
  id: string
  label: string
  year: number | null
  license_plate: string | null
  status: string
  model_id: string
  model: {
    name: string
    tier: string | null
    base_price: number
    price_per_mile: number
    image_url: string | null
    capacity: number
    luggage_capacity: number
    display_order: number
  } | null
}

/** Every physical unit (all statuses), grouped-ready, ordered by model then label. */
export async function getVehicleUnits(): Promise<VehicleUnit[]> {
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('vehicle_units')
    .select(
      'id, label, year, license_plate, status, model_id, model:model_id (name, tier, base_price, price_per_mile, image_url, capacity, luggage_capacity, display_order)',
    )
    .order('label', { ascending: true })
  if (error) {
    console.error('[manager] getVehicleUnits:', error.message)
    return []
  }
  const units = (data ?? []) as unknown as VehicleUnit[]
  return units.sort((a, b) => {
    const oa = a.model?.display_order ?? 999
    const ob = b.model?.display_order ?? 999
    return oa - ob || a.label.localeCompare(b.label)
  })
}

export type AuditEntry = {
  id: string
  created_at: string
  actor_email: string | null
  action: string
  reservation_id: string | null
  details: Record<string, unknown> | null
}

/** Recent audit entries (who did what), newest first. Optionally for one reservation. */
export async function getAuditLog(opts?: {
  reservationId?: string
  limit?: number
}): Promise<AuditEntry[]> {
  const supabase = await staffDb()
  let q = supabase
    .from('audit_log')
    .select('id, created_at, actor_email, action, reservation_id, details')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50)
  if (opts?.reservationId) q = q.eq('reservation_id', opts.reservationId)
  const { data, error } = await q
  if (error) {
    console.error('[manager] getAuditLog:', error.message)
    return []
  }
  return data as unknown as AuditEntry[]
}

export type SupportRequest = {
  id: string
  created_at: string
  kind: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  message: string
  status: string
}

/** Open chatbot escalations (newest first). */
export async function getSupportRequests(limit = 10): Promise<SupportRequest[]> {
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('support_requests')
    .select('id, created_at, kind, customer_name, customer_phone, customer_email, message, status')
    .neq('status', 'handled')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[manager] getSupportRequests:', error.message)
    return []
  }
  return data as unknown as SupportRequest[]
}

export type DashboardStats = {
  pending: number
  confirmed: number
  inProgress: number
  todayCount: number
  openEscalations: number
}

/** Headline counts for the dashboard. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await staffDb()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  const countOf = (build: (q: ReturnType<typeof baseCount>) => ReturnType<typeof baseCount>) =>
    build(baseCount()).then(({ count }) => count ?? 0)

  function baseCount() {
    return supabase.from('reservations').select('id', { count: 'exact', head: true })
  }

  const [pending, confirmed, inProgress, todayCount, openEscalations] = await Promise.all([
    countOf((q) => q.eq('status', 'pending')),
    countOf((q) => q.eq('status', 'confirmed')),
    countOf((q) => q.eq('status', 'in_progress')),
    countOf((q) =>
      q
        .gte('pickup_time', startOfToday.toISOString())
        .lt('pickup_time', endOfToday.toISOString())
        .not('status', 'in', '(cancelled,completed)'),
    ),
    supabase
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'handled')
      .then(({ count }) => count ?? 0),
  ])

  return { pending, confirmed, inProgress, todayCount, openEscalations }
}

export type ManagerFleetModel = {
  id: string
  name: string
  type: string
  capacity: number
  luggage_capacity: number
  base_price: number
  price_per_mile: number
  minimum_price: number
  /** Charter hourly rate (USD/hr). */
  hourly_rate: number
  image_url: string | null
  description: string | null
  featured: boolean
  display_order: number
  tier: string | null
  status: string
}

export async function getFleetModels(): Promise<ManagerFleetModel[]> {
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('fleet')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    console.error('[manager] getFleetModels:', error.message)
    return []
  }
  return data.map((v) => {
    const base = Number(v.base_price || 0)
    const hourly = Number(v.hourly_rate)
    return {
      ...v,
      base_price: base,
      price_per_mile: Number(v.price_per_mile || 0),
      minimum_price: Number(v.minimum_price || 0),
      hourly_rate: Number.isFinite(hourly) && hourly > 0 ? hourly : base,
    }
  }) as ManagerFleetModel[]
}

export type Chauffeur = {
  id: string
  name: string
  phone: string | null
  email: string | null
  notify_email: boolean
  notify_sms: boolean
  status: string
  created_at: string
}

export async function getChauffeurs(): Promise<Chauffeur[]> {
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('chauffeurs')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('[manager] getChauffeurs:', error.message)
    return []
  }
  return data as Chauffeur[]
}

/** Bill-to vendor for staff invoices. */
export type Vendor = {
  id: string
  name: string
  company: string | null
  email: string
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export async function getVendors(): Promise<Vendor[]> {
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('vendors')
    .select('id, name, company, email, phone, notes, created_at, updated_at')
    .order('name', { ascending: true })

  if (error) {
    // Table may not exist until migration is applied — degrade gracefully.
    console.error('[manager] getVendors:', error.message)
    return []
  }
  return (data ?? []) as Vendor[]
}

/** Line item snapshot stored on a sent invoice. */
export type StoredInvoiceLineItem = {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

/** Persisted vendor invoice (sent and retrievable by staff). */
export type StoredInvoice = {
  id: string
  invoice_number: string
  vendor_id: string | null
  vendor_name: string
  vendor_company: string | null
  vendor_email: string
  vendor_phone: string | null
  company_name: string
  company_address: string | null
  company_phone: string | null
  company_email: string | null
  company_website: string | null
  invoice_date: string
  due_date: string | null
  trip_type: 'one_way' | 'round_trip' | 'charter' | null
  duration_hours: number | null
  origin: string | null
  destination: string | null
  departure_at: string | null
  return_at: string | null
  booking_ticket_number: string | null
  items: StoredInvoiceLineItem[]
  subtotal: number
  tax_label: string | null
  tax_amount: number
  discount_amount: number
  other_fees: number
  other_fees_label: string | null
  amount_due: number
  notes: string | null
  accepted_methods: string[]
  ach_instructions: string | null
  zelle_instructions: string | null
  card_instructions: string | null
  card_payment_link: string | null
  email_message_id: string | null
  sent_to: string
  sent_at: string
  status: 'sent' | 'void'
  created_at: string
}

function normalizeInvoiceRow(row: Record<string, unknown>): StoredInvoice {
  const rawItems = Array.isArray(row.items) ? row.items : []
  const items: StoredInvoiceLineItem[] = rawItems
    .map((it) => {
      if (!it || typeof it !== 'object') return null
      const o = it as Record<string, unknown>
      const description = String(o.description ?? '').trim()
      const quantity = Number(o.quantity)
      const unitPrice = Number(o.unitPrice ?? o.unit_price)
      const lineTotal = Number(o.lineTotal ?? o.line_total)
      if (!description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null
      return {
        description,
        quantity,
        unitPrice,
        lineTotal: Number.isFinite(lineTotal)
          ? lineTotal
          : Math.round(quantity * unitPrice * 100) / 100,
      }
    })
    .filter((x): x is StoredInvoiceLineItem => x != null)

  const methods = Array.isArray(row.accepted_methods)
    ? (row.accepted_methods as string[])
    : []

  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number),
    vendor_id: (row.vendor_id as string | null) ?? null,
    vendor_name: String(row.vendor_name ?? ''),
    vendor_company: (row.vendor_company as string | null) ?? null,
    vendor_email: String(row.vendor_email ?? ''),
    vendor_phone: (row.vendor_phone as string | null) ?? null,
    company_name: String(row.company_name ?? 'Imperial Odyssey, LLC'),
    company_address: (row.company_address as string | null) ?? null,
    company_phone: (row.company_phone as string | null) ?? null,
    company_email: (row.company_email as string | null) ?? null,
    company_website: (row.company_website as string | null) ?? null,
    invoice_date: String(row.invoice_date),
    due_date: (row.due_date as string | null) ?? null,
    trip_type:
      row.trip_type === 'one_way' ||
      row.trip_type === 'round_trip' ||
      row.trip_type === 'charter'
        ? row.trip_type
        : null,
    duration_hours:
      row.duration_hours != null && Number.isFinite(Number(row.duration_hours))
        ? Number(row.duration_hours)
        : null,
    origin: (row.origin as string | null) ?? null,
    destination: (row.destination as string | null) ?? null,
    departure_at: (row.departure_at as string | null) ?? null,
    return_at: (row.return_at as string | null) ?? null,
    booking_ticket_number: (row.booking_ticket_number as string | null) ?? null,
    items,
    subtotal: Number(row.subtotal ?? 0),
    tax_label: (row.tax_label as string | null) ?? null,
    tax_amount: Number(row.tax_amount ?? 0),
    discount_amount: Number(row.discount_amount ?? 0),
    other_fees: Number(row.other_fees ?? 0),
    other_fees_label: (row.other_fees_label as string | null) ?? null,
    amount_due: Number(row.amount_due ?? 0),
    notes: (row.notes as string | null) ?? null,
    accepted_methods: methods,
    ach_instructions: (row.ach_instructions as string | null) ?? null,
    zelle_instructions: (row.zelle_instructions as string | null) ?? null,
    card_instructions: (row.card_instructions as string | null) ?? null,
    card_payment_link: (row.card_payment_link as string | null) ?? null,
    email_message_id: (row.email_message_id as string | null) ?? null,
    sent_to: String(row.sent_to ?? row.vendor_email ?? ''),
    sent_at: String(row.sent_at ?? row.created_at),
    status: row.status === 'void' ? 'void' : 'sent',
    created_at: String(row.created_at ?? row.sent_at),
  }
}

export async function getSentInvoices(opts?: {
  limit?: number
  vendorId?: string
}): Promise<StoredInvoice[]> {
  const supabase = await staffDb()
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)

  let q = supabase
    .from('invoices')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (opts?.vendorId) {
    q = q.eq('vendor_id', opts.vendorId)
  }

  const { data, error } = await q

  if (error) {
    console.error('[manager] getSentInvoices:', error.message)
    return []
  }

  return (data ?? []).map((row) => normalizeInvoiceRow(row as Record<string, unknown>))
}

export async function getSentInvoiceById(id: string): Promise<StoredInvoice | null> {
  if (!id?.trim()) return null
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id.trim())
    .maybeSingle()

  if (error) {
    console.error('[manager] getSentInvoiceById:', error.message)
    return null
  }
  if (!data) return null
  return normalizeInvoiceRow(data as Record<string, unknown>)
}