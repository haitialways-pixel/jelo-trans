import { sendMail } from './mailer'
import { fmtDate, fmtTime, EMAIL_RE, fmtMoney } from './format'
import { BRAND_NAME, BRAND_PHONE, BRAND_WEBSITE } from '@/lib/site'

export type BookingReceivedInput = {
  to: string
  customerName: string
  bookingNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffAddress?: string
  vehicleName?: string
  totalPrice: number
}
export type EmailResult = { sent: boolean; reason?: string }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildBookingReceivedContent(i: BookingReceivedInput): { html: string; text: string } {
  const pickupDate = fmtDate(i.pickupTime)
  const pickupTime = fmtTime(i.pickupTime)

  const rows: Array<[string, string]> = [['Booking ID', `#${i.bookingNumber}`]]
  rows.push(['Pickup', `${i.pickupAddress} on ${pickupDate} at ${pickupTime}`])
  if (i.dropoffAddress) rows.push(['Drop-off', i.dropoffAddress])
  if (i.vehicleName) rows.push(['Vehicle', i.vehicleName])
  if (i.totalPrice > 0) {
    rows.push(['Total fare', fmtMoney(i.totalPrice)])
    rows.push(['Deposit', 'No deposit taken'])
    rows.push(['Total amount due', fmtMoney(i.totalPrice)])
  }

  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  const text =
    `Dear ${i.customerName},\n\n` +
    `Thank you for choosing ${BRAND_NAME}. We have received your reservation request ` +
    `and our team is reviewing it now.\n\n` +
    `A confirmation email with full trip details will follow once your reservation is approved.\n\n` +
    `${textRows}\n\n` +
    `Questions? Call us at ${BRAND_PHONE}.\n\n` +
    `— ${BRAND_NAME}\n${BRAND_WEBSITE}`

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap;font-weight:600;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111827;line-height:1.5;">${escapeHtml(value)}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;padding:24px;border-radius:8px;">
            <tr>
              <td>
                <h1 style="margin:0 0 16px;font-size:22px;color:#1f2937;">Reservation Received</h1>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">Dear ${escapeHtml(i.customerName)},</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">
                  Thank you for choosing <strong>${BRAND_NAME}</strong>. We have received your reservation
                  request and our team is reviewing it now.
                </p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">
                  <strong>A confirmation email will follow shortly</strong> once your reservation is approved.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;width:100%;border-collapse:collapse;">${htmlRows}</table>
                <p style="margin:0 0 20px;color:#374151;line-height:1.5;">Questions? Call us at ${BRAND_PHONE}.</p>
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">${BRAND_NAME} · ${BRAND_WEBSITE}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { html, text }
}

/** Plain HTML (no React Email render) for reliable delivery on Cloudflare / Vercel. */
export async function sendBookingReceived(i: BookingReceivedInput): Promise<EmailResult> {
  const to = i.to.trim()
  if (!to || !EMAIL_RE.test(to)) {
    console.warn('[email] sendBookingReceived: invalid recipient', { bookingNumber: i.bookingNumber, to: i.to })
    return { sent: false, reason: 'invalid recipient email' }
  }

  const { html, text } = buildBookingReceivedContent(i)
  const result = await sendMail({
    to,
    fromKind: 'customer',
    subject: `We received your booking with ${BRAND_NAME} #${i.bookingNumber}`,
    html,
    text,
  })

  if (!result.sent) {
    console.warn('[email] sendBookingReceived failed:', result.reason, { bookingNumber: i.bookingNumber, to })
  } else {
    console.info('[email] Booking received email sent', { bookingNumber: i.bookingNumber, to, id: result.id })
  }
  return result
}