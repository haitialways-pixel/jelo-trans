// Management notification — SERVER ONLY. Reusable for chat escalations AND operational
// alerts (new booking, etc.).
//
// Both channels are OPTIONAL and best-effort. Preferred channel: TELEGRAM — free and
// instant (no per-message cost, no email deliverability/domain setup). Email (SMTP) is a
// fallback. If neither is configured, notify is a silent no-op (callers never break).

import { sendMail } from '@/lib/email/mailer'

type NotifyInput = {
  message: string
  /** Optional heading. Defaults to the chat-escalation wording for backward compatibility. */
  title?: string
  context?: Record<string, unknown>
}

export async function notifyManagement(input: NotifyInput): Promise<void> {
  if (await notifyTelegram(input)) return
  await notifyEmail(input)
}

async function notifyTelegram(input: NotifyInput): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false
  const text = input.title
    ? `${input.title}\n\n${input.message}`
    : `🆘 New chat escalation\n\n"${input.message}"\n\nLogged in the support queue — please follow up.`
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
  const to = process.env.MANAGEMENT_EMAIL
  if (!to) return
  const subject = input.title ?? 'New chat escalation — a customer needs a human'
  const body = input.title
    ? input.message
    : `A website visitor asked for something the assistant can't handle:\n\n"${input.message}"\n\n` +
      `It's logged in the support queue (support_requests). Please follow up.`
  await sendMail({
    to,
    subject,
    text: body,
    html: `<p style="font-family:Arial,sans-serif;">${body.replace(/\n/g, '<br>')}</p>`,
  })
}
