// SERVER-ONLY mailer. Resend is the transport, @react-email/render turns React
// components into HTML + plain-text. The exported API is best-effort: if Resend
// isn't configured (RESEND_API_KEY missing), every call returns { sent: false }
// instead of throwing — booking/lifecycle flows must NEVER break because email is
// down or unconfigured.
//
// Required env (.env.local):
//   RESEND_API_KEY=re_xxxxxxxx
//   BOOKING_FROM_EMAIL=Phalo Transportation <bookings@phalotrans.com>   (must be on a verified domain)
import { Resend } from 'resend'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'

let _resend: Resend | null = null

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!_resend) _resend = new Resend(key)
  return _resend
}

// onboarding@resend.dev only works while you're testing on Resend's free tier — once
// you verify a domain, switch BOOKING_FROM_EMAIL to it.
const FROM_FALLBACK = 'Phalo Transportation <onboarding@resend.dev>'

export type MailResult = { sent: boolean; reason?: string }

/** Send a React Email template (rendered to HTML + text). */
export async function sendTemplatedMail(input: {
  to: string
  subject: string
  react: ReactElement
  replyTo?: string
}): Promise<MailResult> {
  const r = getResend()
  if (!r) return { sent: false, reason: 'Resend not configured (RESEND_API_KEY missing)' }
  const from = process.env.BOOKING_FROM_EMAIL || FROM_FALLBACK
  try {
    const [html, text] = await Promise.all([
      render(input.react),
      render(input.react, { plainText: true }),
    ])
    const result = await r.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html,
      text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    })
    if (result.error) return { sent: false, reason: result.error.message }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'send failed' }
  }
}

/** Send a raw HTML email — used by ops alerts (Telegram fallback). */
export async function sendMail(input: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<MailResult> {
  const r = getResend()
  if (!r) return { sent: false, reason: 'Resend not configured' }
  const from = process.env.BOOKING_FROM_EMAIL || FROM_FALLBACK
  try {
    const result = await r.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    })
    if (result.error) return { sent: false, reason: result.error.message }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'send failed' }
  }
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}
