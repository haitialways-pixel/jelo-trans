import { DISPATCH_FROM_NAME, getDispatchReplyToAddress, sendMail } from './mailer'
import { fmtDate, fmtTime, EMAIL_RE, fmtMoney } from './format'
import { BRAND_NAME, BRAND_PHONE, BRAND_WEBSITE } from '@/lib/site'

/**
 * Driver assignment email — hard rule:
 * Include driver name + driver phone, trip logistics, and what the job pays
 * (`driver_pay` / The run pays) at the bottom.
 * Never include SSN/EIN/last4, Driver ID/license/expiration, home or tax address,
 * driver email (except as the To: recipient), or customer charges
 * (total_price, fare, deposit, balance, gratuity).
 */
export type DriverDispatchInput = {
  to: string
  driverName: string
  driverPhone?: string | null
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
  bookingNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffAddress: string
  vehicleName?: string | null
  assignedUnitLabel?: string | null
  passengers?: number
  luggage?: number | null
  durationHours?: number | null
  distanceMiles?: number | null
  specialRequests?: string | null
  status?: string | null
  /** Driver payout only — never customer booking fees. */
  driverPay?: number | null
}

export type EmailResult = { sent: boolean; reason?: string }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatOptional(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null
  return String(value)
}

function buildDriverDispatchContent(i: DriverDispatchInput): { html: string; text: string } {
  const replyTo = getDispatchReplyToAddress()
  const pickupDate = fmtDate(i.pickupTime)
  const pickupTime = fmtTime(i.pickupTime)

  const rows: Array<[string, string]> = [
    ['Driver', i.driverName],
  ]
  const driverPhone = formatOptional(i.driverPhone)
  if (driverPhone) rows.push(['Driver phone', driverPhone])

  rows.push(
    ['Booking ID', `#${i.bookingNumber}`],
    ['Status', i.status ?? 'dispatched'],
    ['Customer', i.customerName],
  )

  const customerEmail = formatOptional(i.customerEmail)
  if (customerEmail) rows.push(['Customer email', customerEmail])

  const customerPhone = formatOptional(i.customerPhone)
  if (customerPhone) rows.push(['Customer phone', customerPhone])

  rows.push(
    ['Pickup date', pickupDate],
    ['Pickup time', pickupTime],
    ['Pickup address', i.pickupAddress],
    ['Drop-off address', i.dropoffAddress],
  )

  if (i.vehicleName) rows.push(['Vehicle class', i.vehicleName])
  if (i.assignedUnitLabel) rows.push(['Assigned vehicle', i.assignedUnitLabel])
  if (i.passengers != null) rows.push(['Passengers', String(i.passengers)])
  if (i.luggage != null) rows.push(['Luggage', String(i.luggage)])
  if (i.durationHours != null) rows.push(['Duration', `${i.durationHours} hour(s)`])
  if (i.distanceMiles != null) rows.push(['Distance', `${i.distanceMiles} miles`])
  if (i.specialRequests) rows.push(['Special requests', i.specialRequests])

  const payEntered = i.driverPay != null && Number.isFinite(Number(i.driverPay))
  const jobPaysLabel = payEntered ? fmtMoney(Number(i.driverPay)) : 'Pay not entered'
  const jobPaysText = `The run pays: ${jobPaysLabel}`

  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  const replyLine =
    `Please reply to this email for any questions or confirmations. ` +
    `Your reply will go to ${replyTo}.`

  const text =
    `Hello ${i.driverName},\n\n` +
    `You have been assigned to the following reservation:\n\n` +
    `${textRows}\n\n` +
    `${replyLine}\n\n` +
    `Please confirm you are available and proceed to the pickup location on time.\n\n` +
    `${jobPaysText}\n\n` +
    `— ${BRAND_NAME}\n${BRAND_PHONE} · ${BRAND_WEBSITE}`

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
                <h1 style="margin:0 0 16px;font-size:22px;color:#1f2937;">New Trip Assignment</h1>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">Hello ${escapeHtml(i.driverName)},</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">You have been assigned to the following reservation:</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;width:100%;border-collapse:collapse;">${htmlRows}</table>
                <p style="margin:0 0 12px;color:#374151;line-height:1.5;font-weight:600;">
                  Please reply to this email for any questions or confirmations.
                </p>
                <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.5;">
                  Replies go directly to <a href="mailto:${escapeHtml(replyTo)}" style="color:#2563eb;">${escapeHtml(replyTo)}</a>.
                </p>
                <p style="margin:0 0 20px;color:#374151;line-height:1.5;">Please confirm you are available and proceed to the pickup location on time.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#111827;border-radius:8px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#9ca3af;">This job pays</p>
                      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${escapeHtml(jobPaysLabel)}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">${BRAND_NAME} · ${BRAND_PHONE} · ${BRAND_WEBSITE}</p>
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
  const replyTo = getDispatchReplyToAddress()
  const subject = `Trip assignment — Booking #${i.bookingNumber}`

  // Use the same From address as booking confirmation (bookings@vipodyssey.com).
  // That sender already delivers in production. Keep dispatch display name + reply-to.
  const result = await sendMail({
    to,
    fromKind: 'customer',
    fromName: DISPATCH_FROM_NAME,
    replyTo,
    subject,
    html,
    text,
  })

  if (!result.sent) {
    console.warn('[email] sendDriverDispatch failed:', result.reason, {
      bookingNumber: i.bookingNumber,
      to,
      replyTo,
    })
  } else {
    console.info('[email] Driver dispatch email sent', {
      bookingNumber: i.bookingNumber,
      to,
      replyTo,
      id: result.id,
    })
  }
  return result
}
