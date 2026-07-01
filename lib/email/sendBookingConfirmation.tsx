import { sendMail } from './mailer'
import { fmtDate, fmtTime, EMAIL_RE } from './format'

export type BookingEmailInput = {
  to: string
  customerName: string
  bookingNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffAddress?: string
  vehicleName?: string
  chauffeurName?: string | null
  chauffeurPhone?: string | null
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

function buildBookingConfirmationContent(i: BookingEmailInput): { html: string; text: string } {
  const pickupDate = fmtDate(i.pickupTime)
  const pickupTime = fmtTime(i.pickupTime)

  const rows: Array<[string, string]> = [
    ['Booking ID', `#${i.bookingNumber}`],
    ['Pickup', `${i.pickupAddress} on ${pickupDate} at ${pickupTime}`],
  ]
  if (i.dropoffAddress) rows.push(['Drop-off', i.dropoffAddress])
  if (i.vehicleName) rows.push(['Vehicle', i.vehicleName])
  if (i.chauffeurName) {
    rows.push([
      'Chauffeur',
      i.chauffeurPhone ? `${i.chauffeurName} (${i.chauffeurPhone})` : i.chauffeurName,
    ])
  }
  rows.push(['Total amount', `$${i.totalPrice}`])

  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  const text =
    `Dear ${i.customerName},\n\n` +
    `Great news — your Phalo Transportation reservation has been confirmed by our team.\n\n` +
    `${textRows}\n\n` +
    `We look forward to providing you with excellent service.\n\n` +
    `Questions? Call us at 678-478-3506.\n\n` +
    `— Phalo Transportation\nwww.phalotrans.com`

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
                <h1 style="margin:0 0 16px;font-size:22px;color:#1f2937;">Your Reservation is Confirmed!</h1>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">Dear ${escapeHtml(i.customerName)},</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">
                  Great news — your <strong>Phalo Transportation</strong> reservation has been confirmed by our team.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;width:100%;border-collapse:collapse;">${htmlRows}</table>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">We look forward to providing you with excellent service.</p>
                <p style="margin:0 0 20px;color:#374151;line-height:1.5;">Questions? Call us at 678-478-3506.</p>
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Phalo Transportation · www.phalotrans.com</p>
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

/** Plain HTML confirmation (no React Email render) for reliable delivery on Vercel. */
export async function sendBookingConfirmation(i: BookingEmailInput): Promise<EmailResult> {
  const to = i.to.trim()
  if (!to || !EMAIL_RE.test(to)) {
    console.warn('[email] sendBookingConfirmation: invalid recipient', { bookingNumber: i.bookingNumber, to: i.to })
    return { sent: false, reason: 'invalid recipient email' }
  }

  const { html, text } = buildBookingConfirmationContent(i)
  const result = await sendMail({
    to,
    fromKind: 'customer',
    subject: `Your Phalo Transportation booking #${i.bookingNumber} is confirmed`,
    html,
    text,
  })

  if (!result.sent) {
    console.warn('[email] sendBookingConfirmation failed:', result.reason, { bookingNumber: i.bookingNumber, to })
  } else {
    console.info('[email] Booking confirmation email sent to customer', {
      bookingNumber: i.bookingNumber,
      to,
      id: result.id,
    })
  }
  return result
}