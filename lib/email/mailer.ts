// SERVER-ONLY mailer via Resend + @react-email/render.
import { Resend } from 'resend'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'

let _resend: Resend | null = null

const RENDER_TIMEOUT_MS = 30_000
const SEND_TIMEOUT_MS = 15_000
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

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms: number = SEND_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
    const html = await withTimeout(render(input.react), 'render email', RENDER_TIMEOUT_MS)
    const text = htmlToPlainText(html)

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