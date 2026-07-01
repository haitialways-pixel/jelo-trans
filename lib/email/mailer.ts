// SERVER-ONLY mailer via Resend + @react-email/render.
import { Resend } from 'resend'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'

let _resend: Resend | null = null

const SEND_TIMEOUT_MS = 12_000
const FROM_FALLBACK = 'Phalo Transportation <onboarding@resend.dev>'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY is not set')
    return null
  }
  if (!_resend) _resend = new Resend(key)
  return _resend
}

function resolveFromAddress(): string {
  const configured = process.env.BOOKING_FROM_EMAIL?.trim()
  if (!configured) return FROM_FALLBACK
  // Resend accepts "Name <email@domain.com>" or bare email.
  if (configured.includes('@')) return configured
  return FROM_FALLBACK
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export type MailResult = { sent: boolean; reason?: string; id?: string }

export async function sendTemplatedMail(input: {
  to: string
  subject: string
  react: ReactElement
  replyTo?: string
}): Promise<MailResult> {
  const r = getResend()
  if (!r) return { sent: false, reason: 'Resend not configured (RESEND_API_KEY missing)' }

  const from = resolveFromAddress()
  try {
    const [html, text] = await withTimeout(
      Promise.all([render(input.react), render(input.react, { plainText: true })]),
      'render email',
    )

    const result = await withTimeout(
      r.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html,
        text,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      }),
      'resend send',
    )

    if (result.error) {
      console.error('[email] Resend API error:', result.error.message, { to: input.to, from })
      return { sent: false, reason: result.error.message }
    }

    console.info('[email] sent', { to: input.to, subject: input.subject, id: result.data?.id })
    return { sent: true, id: result.data?.id }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send failed'
    console.error('[email] send failed:', reason, { to: input.to, from })
    return { sent: false, reason }
  }
}

export async function sendMail(input: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<MailResult> {
  const r = getResend()
  if (!r) return { sent: false, reason: 'Resend not configured' }

  const from = resolveFromAddress()
  try {
    const result = await withTimeout(
      r.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
      'resend send',
    )
    if (result.error) {
      console.error('[email] Resend API error:', result.error.message, { to: input.to, from })
      return { sent: false, reason: result.error.message }
    }
    console.info('[email] sent', { to: input.to, subject: input.subject, id: result.data?.id })
    return { sent: true, id: result.data?.id }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send failed'
    console.error('[email] send failed:', reason, { to: input.to, from })
    return { sent: false, reason }
  }
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}