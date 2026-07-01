// Management notification — SERVER ONLY. Reusable for chat escalations AND operational
// alerts (new booking, etc.).
//
// Telegram is optional and instant when configured. Email goes to MANAGEMENT_EMAIL
// (defaults to info.phalotrans@gmail.com). New online bookings always trigger email
// even when Telegram is configured or deposit is unpaid.

import { sendMail } from '@/lib/email/mailer'

const MANAGEMENT_EMAIL_DEFAULT = 'info.phalotrans@gmail.com'

type NotifyInput = {
  message: string
  /** Optional heading. Defaults to the chat-escalation wording for backward compatibility. */
  title?: string
  context?: Record<string, unknown>
  /**
   * When true, send email in addition to Telegram (not only as a fallback).
   * Use for time-sensitive ops alerts like new online bookings.
   */
  alwaysEmail?: boolean
  /** Optional CTA link (e.g. manager reservation detail page). */
  actionUrl?: string
  /** Link label shown in HTML email and appended to plain text. */
  actionLabel?: string
}

/** Ops inbox for booking alerts and escalations. Override with MANAGEMENT_EMAIL. */
export function getManagementEmail(): string {
  const configured = process.env.MANAGEMENT_EMAIL?.trim()
  if (configured && configured.includes('@')) return configured
  return MANAGEMENT_EMAIL_DEFAULT
}

export async function notifyManagement(input: NotifyInput): Promise<void> {
  if (input.alwaysEmail) {
    await Promise.allSettled([notifyTelegram(input), notifyEmail(input)])
    return
  }

  if (await notifyTelegram(input)) return
  await notifyEmail(input)
}

function appendActionToText(message: string, input: NotifyInput): string {
  if (!input.actionUrl) return message
  const label = input.actionLabel ?? 'Open in manager portal'
  return `${message}\n\n${label}: ${input.actionUrl}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildNotifyHtml(message: string, input: NotifyInput): string {
  const bodyHtml = escapeHtml(message).replace(/\n/g, '<br>')
  const actionBlock = input.actionUrl
    ? `<p style="margin:20px 0 0;">
        <a href="${escapeHtml(input.actionUrl)}"
           style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          ${escapeHtml(input.actionLabel ?? 'Review pending reservation')}
        </a>
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
        <a href="${escapeHtml(input.actionUrl)}" style="color:#2563eb;">${escapeHtml(input.actionUrl)}</a>
      </p>`
    : ''

  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">${bodyHtml}${actionBlock}</div>`
}

async function notifyTelegram(input: NotifyInput): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  const message = appendActionToText(input.message, input)
  const text = input.title
    ? `${input.title}\n\n${message}`
    : `🆘 New chat escalation\n\n"${message}"\n\nLogged in the support queue — please follow up.`

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function notifyEmail(input: NotifyInput): Promise<void> {
  const to = getManagementEmail()
  const subject = input.title ?? 'New chat escalation — a customer needs a human'
  const body = input.title
    ? input.message
    : `A website visitor asked for something the assistant can't handle:\n\n"${input.message}"\n\n` +
      `It's logged in the support queue (support_requests). Please follow up.`

  const text = appendActionToText(body, input)

  const result = await sendMail({
    to,
    fromKind: 'customer',
    subject,
    text,
    html: buildNotifyHtml(body, input),
  })

  if (!result.sent) {
    console.warn('[notifyManagement] ops email failed:', result.reason, { to, subject })
  } else {
    console.info('[notifyManagement] ops email sent', { to, subject, id: result.id })
  }
}