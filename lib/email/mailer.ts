// SERVER-ONLY mailer via Resend + @react-email/render.
import { Resend } from 'resend'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import {
  BRAND_BOOKINGS_EMAIL,
  BRAND_CONCIERGE_EMAIL,
  BRAND_EMAIL,
  BRAND_NAME,
  BRAND_NOREPLY_EMAIL,
  BRAND_WEBSITE,
  rewriteLegacyBrandText,
  rewriteLegacyEmailAddress,
} from '@/lib/site'

let _resend: Resend | null = null

const RENDER_TIMEOUT_MS = 30_000
const SEND_TIMEOUT_MS = 15_000
const SANDBOX_FROM = 'onboarding@resend.dev'
// Do not inherit RESEND_BASE_URL from the worker environment. A value such as
// `https://api.resend.com/emails` makes the SDK POST to `/emails/emails` and
// Resend responds with 405 Method Not Allowed.
const RESEND_API_ORIGIN = 'https://api.resend.com'

/** Default display names per email category */
export const CUSTOMER_FROM_NAME = `${BRAND_NAME} Booking`
export const DISPATCH_FROM_NAME = `Trip Dispatch - ${BRAND_NAME}`

/** Default bare sender addresses (must be verified in Resend) */
export const CUSTOMER_FROM_ADDRESS = BRAND_BOOKINGS_EMAIL
export const DISPATCH_FROM_ADDRESS = BRAND_NOREPLY_EMAIL

const DISPATCH_REPLY_TO_DEFAULT = BRAND_CONCIERGE_EMAIL

export type EmailSenderKind = 'customer' | 'dispatch'

export type FromOverrides = {
  /** Pre-built RFC From header — highest priority */
  from?: string
  /** Customer booking vs driver dispatch profile */
  fromKind?: EmailSenderKind
  /** Override display name only */
  fromName?: string
  /** Override bare email address only */
  fromAddress?: string
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY is not set')
    return null
  }
  if (!_resend) _resend = new Resend(key, { baseUrl: RESEND_API_ORIGIN })
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

/** Extract display name from `Name <email>` if present. */
export function parseFromName(from: string): string | null {
  const match = from.match(/^(.+?)\s*<[^>]+>\s*$/)
  if (!match) return null
  return match[1].replace(/^["']|["']$/g, '').trim() || null
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

function isValidResendFromAddress(email: string): boolean {
  const normalized = email.toLowerCase()
  if (!normalized.includes('@')) return false

  const domain = normalized.split('@')[1] ?? ''
  if (!domain || domain.includes('..')) return false
  if (/\.(com|net|org|io|co)\.(com|net|org|io|co)$/i.test(domain)) return false
  if (BLOCKED_FROM_DOMAINS.has(domain)) return false

  return true
}

/** Build a Resend-compatible From header from display name + bare address. */
export function formatFromHeader(displayName: string, email: string): string {
  const trimmedName = displayName.trim()
  const trimmedEmail = email.trim()
  const needsQuotes = /[,;<>@"\\]/.test(trimmedName)
  const safeName = needsQuotes
    ? `"${trimmedName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : trimmedName
  return `${safeName} <${trimmedEmail}>`
}

function readBareAddress(envKey: string, legacyEnvKey: string | null, fallback: string): string {
  const explicit = process.env[envKey]?.trim()
  if (explicit && explicit.includes('@')) {
    return rewriteLegacyEmailAddress(explicit, fallback)
  }

  if (legacyEnvKey) {
    const legacy = process.env[legacyEnvKey]?.trim()
    if (legacy && legacy.includes('@')) {
      return rewriteLegacyEmailAddress(parseFromEmail(legacy), fallback)
    }
  }

  return fallback
}

function defaultNameForKind(kind: EmailSenderKind): string {
  if (kind === 'dispatch') {
    return process.env.DISPATCH_FROM_NAME?.trim() || DISPATCH_FROM_NAME
  }
  return process.env.BOOKING_FROM_NAME?.trim() || CUSTOMER_FROM_NAME
}

function defaultAddressForKind(kind: EmailSenderKind): string {
  if (kind === 'dispatch') {
    return readBareAddress('DISPATCH_FROM_ADDRESS', 'DISPATCH_FROM_EMAIL', DISPATCH_FROM_ADDRESS)
  }
  return readBareAddress('BOOKING_FROM_ADDRESS', 'BOOKING_FROM_EMAIL', CUSTOMER_FROM_ADDRESS)
}

/** Resolve the full From header for a sender profile. */
export function resolveFromHeader(overrides: FromOverrides = {}): string {
  if (overrides.from?.trim()) {
    const raw = overrides.from.trim()
    const email = rewriteLegacyEmailAddress(parseFromEmail(raw), CUSTOMER_FROM_ADDRESS)
    const name = parseFromName(raw) || defaultNameForKind(overrides.fromKind ?? 'customer')
    if (useSandboxFrom()) return formatFromHeader(name, SANDBOX_FROM)
    if (!isValidResendFromAddress(email)) {
      console.warn('[email] invalid from address; using Resend sandbox sender', { email })
      return formatFromHeader(name, SANDBOX_FROM)
    }
    return formatFromHeader(name, email)
  }

  const kind = overrides.fromKind ?? 'customer'

  if (useSandboxFrom()) {
    const name = overrides.fromName?.trim() || defaultNameForKind(kind)
    return formatFromHeader(name, SANDBOX_FROM)
  }

  const fallback = defaultAddressForKind(kind)
  const email = rewriteLegacyEmailAddress(
    overrides.fromAddress?.trim() || fallback,
    fallback,
  )
  if (!isValidResendFromAddress(email)) {
    console.warn('[email] invalid from address; using Resend sandbox sender', { kind, email })
    const name = overrides.fromName?.trim() || defaultNameForKind(kind)
    return formatFromHeader(name, SANDBOX_FROM)
  }

  const name = overrides.fromName?.trim() || defaultNameForKind(kind)
  return formatFromHeader(name, email)
}

/** @deprecated Use resolveFromHeader({ fromKind: 'customer' }) */
export function getMailFromAddress(): string {
  return resolveFromHeader({ fromKind: 'customer' })
}

/** @deprecated Use resolveFromHeader({ fromKind: 'dispatch' }) */
export function getDispatchFromAddress(): string {
  return resolveFromHeader({ fromKind: 'dispatch' })
}

/** True when sending via Resend's test sender (no custom domain verified yet). */
export function isResendSandboxMode(): boolean {
  return resolveFromHeader({ fromKind: 'customer' }).includes(SANDBOX_FROM)
}

/** Reply-To for driver dispatch — driver replies land here (defaults to concierge@vipodyssey.com). */
export function getDispatchReplyToAddress(): string {
  const configured = process.env.DISPATCH_REPLY_TO_EMAIL?.trim()
  if (configured && configured.includes('@')) {
    return rewriteLegacyEmailAddress(configured, DISPATCH_REPLY_TO_DEFAULT)
  }
  return DISPATCH_REPLY_TO_DEFAULT
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
      `Verify your domain in Resend and set BOOKING_FROM_ADDRESS / DISPATCH_FROM_ADDRESS, ` +
      `or use RESEND_USE_SANDBOX_FROM=true with onboarding@resend.dev for testing.`
    )
  }

  if (
    from.includes(SANDBOX_FROM) &&
    (lower.includes('only send') || lower.includes('testing') || lower.includes('your own'))
  ) {
    return (
      `Resend sandbox: emails can only be delivered to your Resend account email until a domain is verified. ` +
      `Cannot send to ${to}.`
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

type SendOptions = FromOverrides & {
  to: string
  subject: string
  replyTo?: string
}

export async function sendTemplatedMail(
  input: SendOptions & { react: ReactElement },
): Promise<MailResult> {
  const r = getResend()
  if (!r) return { sent: false, reason: 'Resend not configured (RESEND_API_KEY missing)' }

  const from = resolveFromHeader(input)
  try {
    const rendered = await withTimeout(render(input.react), 'render email', RENDER_TIMEOUT_MS)
    // Final safety net: never deliver retired Phalo domains in any template email.
    const html = rewriteLegacyBrandText(rendered)
    const text = rewriteLegacyBrandText(htmlToPlainText(html))
    const subject = rewriteLegacyBrandText(input.subject)
    const replyTo = input.replyTo
      ? rewriteLegacyEmailAddress(input.replyTo, DISPATCH_REPLY_TO_DEFAULT)
      : undefined

    const result = await withTimeout(
      r.emails.send({
        from,
        to: input.to,
        subject,
        html,
        text,
        ...(replyTo ? { replyTo } : {}),
      }),
      'resend send',
    )

    if (result.error) {
      const reason = friendlyResendError(result.error.message, from, input.to)
      console.error('[email] Resend API error:', reason, { to: input.to, from })
      return { sent: false, reason }
    }

    console.info('[email] sent', { to: input.to, subject, from, id: result.data?.id })
    return { sent: true, id: result.data?.id }
  } catch (e) {
    const reason = friendlyResendError(e instanceof Error ? e.message : 'send failed', from, input.to)
    console.error('[email] send failed:', reason, { to: input.to, from })
    return { sent: false, reason }
  }
}

export async function sendMail(
  input: SendOptions & { html: string; text?: string },
): Promise<MailResult> {
  const r = getResend()
  if (!r) return { sent: false, reason: 'Resend not configured' }

  const from = resolveFromHeader(input)
  // Final safety net: never deliver retired Phalo domains in any plain-HTML email.
  const html = rewriteLegacyBrandText(input.html)
  const text = input.text ? rewriteLegacyBrandText(input.text) : undefined
  const subject = rewriteLegacyBrandText(input.subject)
  const replyTo = input.replyTo
    ? rewriteLegacyEmailAddress(input.replyTo, DISPATCH_REPLY_TO_DEFAULT)
    : undefined
  try {
    const result = await withTimeout(
      r.emails.send({
        from,
        to: input.to,
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { replyTo } : {}),
      }),
      'resend send',
    )
    if (result.error) {
      const reason = friendlyResendError(result.error.message, from, input.to)
      console.error('[email] Resend API error:', reason, { to: input.to, from })
      return { sent: false, reason }
    }
    console.info('[email] sent', { to: input.to, subject, from, id: result.data?.id })
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
  if (!isMailConfigured()) return 'RESEND_API_KEY is not set in environment variables.'
  if (isResendSandboxMode()) {
    return (
      'Resend sandbox mode: customer emails can ONLY be delivered to your Resend account signup email ' +
      `(manager alerts to ${BRAND_EMAIL} may work, but other customer addresses will fail). ` +
      `Verify ${BRAND_WEBSITE} in Resend, set BOOKING_FROM_ADDRESS=${BRAND_BOOKINGS_EMAIL}, then remove RESEND_USE_SANDBOX_FROM.`
    )
  }
  return null
}
