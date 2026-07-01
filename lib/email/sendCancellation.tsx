import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { CancellationEmail } from '@/lib/emails'
import { EMAIL_RE } from './format'

export type Input = {
  to: string
  customerName: string
  bookingNumber: string
  cancellationReason?: string | null
  refundInfo?: string | null
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendCancellation(i: Input): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) return { sent: false, reason: 'invalid recipient email' }
  return sendTemplatedMail({
    to: i.to,
    fromKind: 'customer',
    subject: `Your Phalo Transportation booking #${i.bookingNumber} has been cancelled`,
    react: (
      <CancellationEmail
        customerName={i.customerName}
        bookingId={i.bookingNumber}
        cancellationReason={i.cancellationReason ?? undefined}
        refundInfo={i.refundInfo ?? undefined}
      />
    ),
  })
}
