'use server'

import { checkRateLimit } from '@/lib/security/rateLimit'
import { sendMail } from '@/lib/email/mailer'
import {
  BRAND_CONCIERGE_EMAIL,
  BRAND_NAME,
  BRAND_NOREPLY_EMAIL,
  BRAND_PHONE_DISPLAY,
} from '@/lib/site'

export type ContactState = {
  ok: boolean
  error?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}

export async function submitContact(_prev: ContactState | null, formData: FormData): Promise<ContactState> {
  const honeypot = str(formData, 'company_url')
  if (honeypot) {
    return { ok: true }
  }

  const name = str(formData, 'name')
  const email = str(formData, 'email')
  const phone = str(formData, 'phone')
  const message = str(formData, 'message')

  if (!name || name.length < 2) return { ok: false, error: 'Please enter your name.' }
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return { ok: false, error: 'Please enter a phone number we can reach you on.' }
  }
  if (!message || message.length < 10) {
    return { ok: false, error: 'Please tell us how we can help (at least a sentence).' }
  }

  const rl = await checkRateLimit('contact.submit', 5, 3600)
  if (!rl.ok) {
    return {
      ok: false,
      error: `Too many messages. Please call or text ${BRAND_PHONE_DISPLAY} and we’ll help you right away.`,
    }
  }

  const html =
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
    `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
    `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` +
    `<p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`

  const text = `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`

  const result = await sendMail({
    to: BRAND_CONCIERGE_EMAIL,
    fromKind: 'customer',
    fromName: `${BRAND_NAME} Concierge`,
    fromAddress: BRAND_NOREPLY_EMAIL,
    replyTo: email,
    subject: `Website inquiry from ${name}`,
    html,
    text,
  })

  if (!result.sent) {
    return {
      ok: false,
      error: `We could not send your message just now. Please call or text ${BRAND_PHONE_DISPLAY} and our concierge will take care of you.`,
    }
  }

  return { ok: true }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
