import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { ManualReceiptEmail, type ManualReceiptEmailProps } from '@/lib/emails'
import { EMAIL_RE } from './format'

export type EmailResult = { sent: boolean; reason?: string }

export async function sendManualReceiptEmail(
  to: string,
  props: ManualReceiptEmailProps,
): Promise<EmailResult> {
  if (!to || !EMAIL_RE.test(to)) return { sent: false, reason: 'invalid recipient email' }
  return sendTemplatedMail({
    to,
    fromKind: 'customer',
    subject: `Payment receipt ${props.receiptNumber} — ${props.companyName}`,
    react: <ManualReceiptEmail {...props} />,
  })
}
