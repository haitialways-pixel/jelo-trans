import { sendMail, type MailResult } from '@/lib/email/mailer'
import { BRAND_CONCIERGE_EMAIL, BRAND_NAME, getSiteUrl } from '@/lib/site'

/** Manager sign-in page. Follows SITE_URL, then the public site URL already configured. */
export function managerLoginUrl(): string {
  return `${getSiteUrl()}/manager/login`
}

/**
 * Welcome note for a newly created Auth user.
 * Does not include a password and does not claim one was set.
 * From address is the concierge mailbox the mailer already uses as reply-to.
 */
export async function sendAuthUserCreatedEmail(email: string): Promise<MailResult> {
  const loginUrl = managerLoginUrl()
  const subject = `Your ${BRAND_NAME} manager account is ready`
  const text = [
    `Your ${BRAND_NAME} manager account is ready.`,
    '',
    `Sign in at ${loginUrl}`,
    '',
    'A manager must add you to the staff table before you can get in.',
    'This message does not include a password.',
    '',
    BRAND_NAME,
  ].join('\n')

  const safeUrl = loginUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const html = [
    `<p>Your ${BRAND_NAME} manager account is ready.</p>`,
    `<p>Sign in at <a href="${safeUrl}">${safeUrl}</a>.</p>`,
    '<p>A manager must add you to the staff table before you can get in.</p>',
    '<p>This message does not include a password.</p>',
    `<p>${BRAND_NAME}</p>`,
  ].join('\n')

  return sendMail({
    to: email,
    fromName: BRAND_NAME,
    fromAddress: BRAND_CONCIERGE_EMAIL,
    replyTo: BRAND_CONCIERGE_EMAIL,
    subject,
    html,
    text,
  })
}
