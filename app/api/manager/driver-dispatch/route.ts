import { NextResponse } from 'next/server'
import { sendDriverDispatchNotification } from '@/lib/manager/dispatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DispatchBody = {
  reservationId?: unknown
  unitId?: unknown
  chauffeurName?: unknown
  chauffeurId?: unknown
  driverPay?: unknown
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Explicit POST endpoint for the dispatch button.
 * This avoids relying on Server Action request handling in the Worker runtime.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}

export async function POST(request: Request) {
  let body: DispatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const reservationId = nullableString(body.reservationId)
  if (!reservationId) {
    return NextResponse.json({ ok: false, error: 'Reservation is required' }, { status: 400 })
  }

  const parsedPay = body.driverPay == null || body.driverPay === '' ? null : Number(body.driverPay)
  if (parsedPay !== null && (!Number.isFinite(parsedPay) || parsedPay < 0)) {
    return NextResponse.json({ ok: false, error: 'The run pays must be a valid amount' }, { status: 400 })
  }

  const result = await sendDriverDispatchNotification(reservationId, {
    unitId: nullableString(body.unitId),
    chauffeurName: typeof body.chauffeurName === 'string' ? body.chauffeurName : '',
    chauffeurId: nullableString(body.chauffeurId),
    driverPay: parsedPay,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
