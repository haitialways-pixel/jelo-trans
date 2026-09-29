import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { isMailConfigured } from '@/lib/email/mailer'
import { sendAuthUserCreatedEmail } from '@/lib/email/sendAuthUserCreated'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Supabase Database Webhook for a new Auth user.
 *
 * Dashboard → Database → Webhooks → Create hook:
 *   Schema auth, table users, event Insert only, method POST.
 *   URL: {SITE_URL or the deployed worker}/api/auth/user-created
 *   Header name: x-webhook-secret
 *   Header value: the Cloudflare secret AUTH_USER_CREATED_WEBHOOK_SECRET
 *   Timeout: 10000 ms (Resend can take longer than the 1000 ms default).
 *
 * Do not commit the secret. Mail goes out through the existing Resend helper
 * and fails closed when RESEND_API_KEY is missing.
 */
const SECRET_HEADER = 'x-webhook-secret'

type AuthUserRecord = {
  email?: string | null
}

type WebhookBody = {
  type?: string
  table?: string
  schema?: string
  record?: AuthUserRecord | null
  email?: string | null
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

function readEmail(body: WebhookBody): string | null {
  const raw = body.record?.email ?? body.email ?? ''
  const email = raw.trim()
  if (!email || email.length > 320 || /[\r\n]/.test(email) || !email.includes('@')) return null
  return email
}

export async function POST(req: Request) {
  const expected = process.env.AUTH_USER_CREATED_WEBHOOK_SECRET?.trim()
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'AUTH_USER_CREATED_WEBHOOK_SECRET is not set' },
      { status: 503 },
    )
  }

  const provided = req.headers.get(SECRET_HEADER) ?? ''
  if (!provided || !secretsMatch(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = (await req.json()) as WebhookBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.type && body.type.toUpperCase() !== 'INSERT') {
    return NextResponse.json({ ok: true, skipped: 'not an insert' })
  }
  if (body.schema && body.schema !== 'auth') {
    return NextResponse.json({ ok: true, skipped: 'not auth schema' })
  }
  if (body.table && body.table !== 'users') {
    return NextResponse.json({ ok: true, skipped: 'not users table' })
  }

  const email = readEmail(body)
  if (!email) {
    return NextResponse.json({ ok: true, skipped: 'no email' })
  }

  if (!isMailConfigured()) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY is not set' }, { status: 503 })
  }

  const result = await sendAuthUserCreatedEmail(email)
  if (!result.sent) {
    console.error('[auth-user-created] email failed', result.reason ?? 'send failed')
    return NextResponse.json(
      { ok: false, error: result.reason ?? 'send failed' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, id: result.id ?? null })
}
