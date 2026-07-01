// SERVER-ONLY mailer via Resend + @react-email/render.
import { Resend } from 'resend'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'

let _resend: Resend | null = null

const RENDER_TIMEOUT_MS = 30_000
const SEND_TIMEOUT_MS = 15_000
const FROM_FALLBACK = 'Phalo Transportation <onboarding@resend.dev>'
const SANDBOX_FROM = 'onboarding@resend.dev'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY is not set')
    return null
  }
  if (!_resend) _resend = new Resend(key)
  return _resend
}

function useSandboxFrom(): boolean {
  const flag = process.env.RESEND_USE_SANDBOX_FROM?.trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
}

/** Extract bare address from `Name <user@domain.com>` or return input if already bare. */
export function parseFromEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match?.[1] ?? from).trim()
}

const BLOCKED_FROM_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'msn.com',
])

function isValidResendFromAddress(from: string): boolean {
  const email = parseFromEmail(from).toLowerCase()
  if (!email.includes('@')) return false

  const domain = email.split('@')[1] ?? ''
  if (!domain || domain.includes('..')) return false
  // Catches typos like gmail.com.com or phalotrans.com.com
  if (/\.(com|net|org|io|co)\.(com|net|org|io|co)$/i.test(domain)) return false
  if (BLOCKED_FROM_DOMAINS.has(domain)) return false

  return true
}

/** Resolved sender used for all outbound mail. */
export function getMailFromAddress(): string {
  if (useSandboxFrom()) return FROM_FALLBACK

  const configured = process.env.BOOKING_FROM_EMAIL?.trim()
  if (!configured) return FROM_FALLBACK
  if (!configured.includes('@')) return FROM_FALLBACK

  if (!isValidResendFromAddress(configured)) {
    console.warn(
      '[email] BOOKING_FROM_EMAIL is not a valid Resend sender; using sandbox fallback.',
      { configured },
    )
    return FROM_FALLBACK
  }

  return configured
}

/** True when sending via Resend's test sender (no custom domain verified yet). */
export function isResendSandboxMode(): boolean {
  return getMailFromAddress().includes(SANDBOX_FROM)
}

function friendlyResendError(message: string, from: string, to: string): string {
  const lower = message.toLowerCase()

  if (
    lower.includes('not authorized') ||
    (lower.includes('domain') && (lower.includes('verified') || lower.includes('not found')))
  ) {
    const parsed = parseFromEmail(from)
    return (
      `Resend cannot send from "${parsed}". ` +
      `You cannot use Gmail/Yahoo addresses as the sender, and typos like "gmail.com.com" will fail. ` +
      `Until your own domain is verified in Resend, set on Vercel: ` +
      `RESEND_USE_SANDBOX_FROM=true and BOOKING_FROM_EMAIL="Phalo Transportation <onboarding@resend.dev>".`
    )
  }

  if (
    from.includes(SANDBOX_FROM) &&
    (lower.includes('only send') || lower.includes('testing') || lower.includes('your own'))
  ) {
    return (
      `Resend sandbox: emails can only be delivered to your Resend account email until a domain is verified. ` +
      `Cannot send to ${to}. Add the driver's email as a chauffeur contact after domain verification.`
    )
  }

  return message
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

  const from = getMailFromAddress()
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
      const reason = friendlyResendError(result.error.message, from, input.to)
      console.error('[email] Resend API error:', reason, { to: input.to, from })
      return { sent: false, reason }
    }

    console.info('[email] sent', { to: input.to, subject: input.subject, id: result.data?.id })
    return { sent: true, id: result.data?.id }
  } catch (e) {
    const reason = friendlyResendError(e instanceof Error ? e.message : 'send failed', from, input.to)
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

  const from = getMailFromAddress()
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
      const reason = friendlyResendError(result.error.message, from, input.to)
      console.error('[email] Resend API error:', reason, { to: input.to, from })
      return { sent: false, reason }
    }
    console.info('[email] sent', { to: input.to, subject: input.subject, id: result.data?.id })
    return { sent: true, id: result.data?.id }
  } catch (e) {
    const reason = friendlyResendError(e instanceof Error ? e.message : 'send failed', from, input.to)
    console.error('[email] send failed:', reason, { to: input.to, from })
    return { sent: false, reason }
  }
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function getMailSetupHint(): string | null {
  if (!isMailConfigured()) return 'RESEND_API_KEY is not set in Vercel environment variables.'
  if (isResendSandboxMode()) {
    return (
      'Resend sandbox mode: only your Resend account email can receive mail until you verify a custom domain. ' +
      'Verify phalotrans.com (or your domain) in Resend, then set BOOKING_FROM_EMAIL to that domain and remove RESEND_USE_SANDBOX_FROM.'
    )
  }
  return null
}