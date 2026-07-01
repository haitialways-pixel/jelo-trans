import { sendMail } from './mailer'
import { fmtDate, fmtTime, EMAIL_RE } from './format'

export type DriverDispatchInput = {
  to: string
  driverName: string
  customerName: string
  bookingNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffAddress: string
  vehicleName?: string | null
  passengers?: number
  specialRequests?: string | null
  totalPrice?: number | null
}
export type EmailResult = { sent: boolean; reason?: string }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildDriverDispatchContent(i: DriverDispatchInput): { html: string; text: string } {
  const pickupDate = fmtDate(i.pickupTime)
  const pickupTime = fmtTime(i.pickupTime)
  const rows: Array<[string, string]> = [
    ['Booking ID', `#${i.bookingNumber}`],
    ['Customer', i.customerName],
    ['Pickup', `${i.pickupAddress} on ${pickupDate} at ${pickupTime}`],
    ['Drop-off', i.dropoffAddress],
  ]
  if (i.vehicleName) rows.push(['Vehicle', i.vehicleName])
  if (i.passengers != null) rows.push(['Passengers', String(i.passengers)])
  if (i.specialRequests) rows.push(['Special requests', i.specialRequests])
  if (i.totalPrice != null) rows.push(['Total fare', `$${i.totalPrice}`])

  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  const text =
    `Hello ${i.driverName},\n\n` +
    `You have been assigned to the following reservation:\n\n` +
    `${textRows}\n\n` +
    `Please confirm you are available and proceed to the pickup location on time.\n\n` +
    `— Phalo Transportation\n678-478-3506 · www.phalotrans.com`

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111827;">${escapeHtml(value)}</td></tr>`,
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
                <h1 style="margin:0 0 16px;font-size:22px;color:#1f2937;">New Trip Assignment</h1>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">Hello ${escapeHtml(i.driverName)},</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">You have been assigned to the following reservation:</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;width:100%;">${htmlRows}</table>
                <p style="margin:0 0 20px;color:#374151;line-height:1.5;">Please confirm you are available and proceed to the pickup location on time.</p>
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Phalo Transportation · 678-478-3506 · www.phalotrans.com</p>
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

/** Driver dispatch uses plain HTML (no React Email render) for fast, reliable delivery. */
export async function sendDriverDispatch(i: DriverDispatchInput): Promise<EmailResult> {
  const to = i.to.trim()
  if (!to || !EMAIL_RE.test(to)) {
    console.warn('[email] sendDriverDispatch: invalid recipient', { bookingNumber: i.bookingNumber, to: i.to })
    return { sent: false, reason: 'invalid driver email' }
  }

  const { html, text } = buildDriverDispatchContent(i)
  const result = await sendMail({
    to,
    subject: `Trip assignment — Booking #${i.bookingNumber}`,
    html,
    text,
  })

  if (!result.sent) {
    console.warn('[email] sendDriverDispatch failed:', result.reason, { bookingNumber: i.bookingNumber, to })
  } else {
    console.info('[email] Driver dispatch email sent', { bookingNumber: i.bookingNumber, to, id: result.id })
  }
  return result
}