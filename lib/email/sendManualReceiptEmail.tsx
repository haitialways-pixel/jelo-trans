// Plain HTML receipt email (no @react-email/render) — same reliability path as
// sendBookingConfirmation. React Email render has failed on Workers/serverless.
import { sendMail } from './mailer'
import { EMAIL_RE, fmtMoney } from './format'

export type EmailResult = { sent: boolean; reason?: string; id?: string }

export type ManualReceiptLineItem = {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type ManualReceiptEmailProps = {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  receiptNumber: string
  receiptDateTime: string
  tripType?: 'one_way' | 'round_trip'
  customerName: string
  customerEmail?: string
  customerPhone?: string
  origin?: string
  destination?: string
  departureDateTime?: string
  returnDateTime?: string
  bookingTicketNumber?: string
  items: ManualReceiptLineItem[]
  subtotal: number
  taxLabel?: string
  taxAmount: number
  discountAmount: number
  otherFees: number
  otherFeesLabel?: string
  grandTotal: number
  paymentMethod?: string
  amountPaid: number
  paymentReference?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number): string {
  return fmtMoney(n)
}

function buildManualReceiptContent(props: ManualReceiptEmailProps): {
  html: string
  text: string
} {
  const tripLabel =
    props.tripType === 'round_trip'
      ? 'Round Trip'
      : props.tripType === 'one_way'
        ? 'One-Way'
        : undefined
  const balance = Math.max(0, props.grandTotal - props.amountPaid)

  const companyLine = [props.companyPhone, props.companyEmail, props.companyWebsite]
    .filter(Boolean)
    .join(' · ')

  // ---- plain text ----
  const textLines: string[] = [
    `Payment Receipt #${props.receiptNumber}`,
    props.companyName,
    props.companyAddress || '',
    companyLine,
    '',
    `Date & time: ${props.receiptDateTime}`,
    tripLabel ? `Trip type: ${tripLabel}` : '',
    `Customer: ${props.customerName}`,
    [props.customerEmail, props.customerPhone].filter(Boolean).join(' · '),
    props.bookingTicketNumber ? `Booking / ticket #: ${props.bookingTicketNumber}` : '',
    '',
  ]

  if (props.origin || props.destination || props.departureDateTime || props.returnDateTime) {
    textLines.push('Journey details')
    if (props.origin) textLines.push(`From: ${props.origin}`)
    if (props.destination) textLines.push(`To: ${props.destination}`)
    if (props.departureDateTime) textLines.push(`Departure: ${props.departureDateTime}`)
    if (props.returnDateTime) textLines.push(`Return: ${props.returnDateTime}`)
    textLines.push('')
  }

  textLines.push('Items / services')
  for (const item of props.items) {
    textLines.push(
      `• ${item.description} | qty ${item.quantity} × ${money(item.unitPrice)} = ${money(item.lineTotal)}`,
    )
  }
  textLines.push('')
  textLines.push(`Subtotal: ${money(props.subtotal)}`)
  if (props.taxAmount > 0) textLines.push(`${props.taxLabel || 'Tax'}: ${money(props.taxAmount)}`)
  if (props.discountAmount > 0) textLines.push(`Discount: -${money(props.discountAmount)}`)
  if (props.otherFees > 0) {
    textLines.push(`${props.otherFeesLabel || 'Other fees'}: ${money(props.otherFees)}`)
  }
  textLines.push(`Grand total: ${money(props.grandTotal)}`)
  textLines.push('')
  if (props.paymentMethod) textLines.push(`Payment method: ${props.paymentMethod}`)
  textLines.push(`Amount paid: ${money(props.amountPaid)}`)
  if (balance > 0.009) textLines.push(`Balance due: ${money(balance)}`)
  if (props.paymentReference) textLines.push(`Payment reference: ${props.paymentReference}`)
  textLines.push('')
  textLines.push(`Thank you for choosing ${props.companyName}.`)
  textLines.push('Questions? Call 678-478-3506 · phalotrans.com')

  const text = textLines.filter((l) => l !== undefined).join('\n')

  // ---- HTML ----
  const itemRows = props.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 6px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">${escapeHtml(item.description)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;color:#111827;">${item.quantity}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;color:#111827;">${escapeHtml(money(item.unitPrice))}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;color:#111827;">${escapeHtml(money(item.lineTotal))}</td>
        </tr>`,
    )
    .join('')

  const metaRows: Array<[string, string]> = [
    ['Date & time', props.receiptDateTime],
  ]
  if (tripLabel) metaRows.push(['Trip type', tripLabel])
  metaRows.push(['Customer', props.customerName])
  const contact = [props.customerEmail, props.customerPhone].filter(Boolean).join(' · ')
  if (contact) metaRows.push(['Contact', contact])
  if (props.bookingTicketNumber) metaRows.push(['Booking / ticket #', props.bookingTicketNumber])

  const metaHtml = metaRows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:4px 0;color:#111827;font-size:13px;line-height:1.5;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')

  const journeyRows: Array<[string, string]> = []
  if (props.origin) journeyRows.push(['From', props.origin])
  if (props.destination) journeyRows.push(['To', props.destination])
  if (props.departureDateTime) journeyRows.push(['Departure', props.departureDateTime])
  if (props.returnDateTime) journeyRows.push(['Return', props.returnDateTime])
  const journeyHtml =
    journeyRows.length > 0
      ? `<h3 style="margin:20px 0 8px;font-size:15px;color:#1f2937;">Journey details</h3>
         <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
           ${journeyRows
             .map(
               ([label, value]) =>
                 `<tr>
                   <td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
                   <td style="padding:4px 0;color:#111827;font-size:13px;line-height:1.5;">${escapeHtml(value)}</td>
                 </tr>`,
             )
             .join('')}
         </table>`
      : ''

  const totalRows: Array<[string, string]> = [['Subtotal', money(props.subtotal)]]
  if (props.taxAmount > 0) totalRows.push([props.taxLabel || 'Tax', money(props.taxAmount)])
  if (props.discountAmount > 0) totalRows.push(['Discount', `-${money(props.discountAmount)}`])
  if (props.otherFees > 0) {
    totalRows.push([props.otherFeesLabel || 'Other fees', money(props.otherFees)])
  }
  totalRows.push(['Grand total', money(props.grandTotal)])

  const totalsHtml = totalRows
    .map(
      ([label, value], i) => {
        const last = i === totalRows.length - 1
        return `<tr>
          <td style="padding:${last ? '10px' : '4px'} 0;color:${last ? '#111827' : '#4b5563'};font-size:${last ? '14px' : '13px'};font-weight:${last ? 700 : 400};">${escapeHtml(label)}</td>
          <td style="padding:${last ? '10px' : '4px'} 0;color:#111827;font-size:${last ? '14px' : '13px'};font-weight:${last ? 700 : 400};text-align:right;">${escapeHtml(value)}</td>
        </tr>`
      },
    )
    .join('')

  const payRows: Array<[string, string]> = []
  if (props.paymentMethod) payRows.push(['Method', props.paymentMethod])
  payRows.push(['Amount paid', money(props.amountPaid)])
  if (balance > 0.009) payRows.push(['Balance due', money(balance)])
  if (props.paymentReference) payRows.push(['Payment reference', props.paymentReference])

  const payHtml = payRows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:4px 0;color:#111827;font-size:13px;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;padding:28px 24px;border-radius:8px;">
            <tr>
              <td>
                <h1 style="margin:0 0 4px;font-size:22px;color:#1f2937;">Payment Receipt</h1>
                <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Receipt #${escapeHtml(props.receiptNumber)}</p>

                <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(props.companyName)}</p>
                ${props.companyAddress ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(props.companyAddress)}</p>` : ''}
                ${companyLine ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(companyLine)}</p>` : ''}

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                  ${metaHtml}
                </table>

                ${journeyHtml}

                <h3 style="margin:20px 0 8px;font-size:15px;color:#1f2937;">Items / services</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:8px 6px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:600;">Description</th>
                      <th align="right" style="padding:8px 6px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:600;width:48px;">Qty</th>
                      <th align="right" style="padding:8px 6px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:600;width:80px;">Unit</th>
                      <th align="right" style="padding:8px 6px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:600;width:88px;">Total</th>
                    </tr>
                  </thead>
                  <tbody>${itemRows}</tbody>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border-collapse:collapse;">
                  ${totalsHtml}
                </table>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

                <h3 style="margin:0 0 8px;font-size:15px;color:#1f2937;">Payment</h3>
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                  ${payHtml}
                </table>

                <p style="margin:24px 0 0;color:#374151;font-size:14px;line-height:1.5;">
                  Thank you for choosing <strong>${escapeHtml(props.companyName)}</strong>. We appreciate your business.
                </p>
                <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                  Imperial Odyssey · 678-478-3506 · phalotrans.com<br />
                  This is a transactional receipt. For questions, call us at 678-478-3506.
                </p>
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

export async function sendManualReceiptEmail(
  to: string,
  props: ManualReceiptEmailProps,
): Promise<EmailResult> {
  const recipient = to.trim()
  if (!recipient || !EMAIL_RE.test(recipient)) {
    return { sent: false, reason: 'invalid recipient email' }
  }

  try {
    const { html, text } = buildManualReceiptContent(props)
    const result = await sendMail({
      to: recipient,
      fromKind: 'customer',
      subject: `Payment receipt ${props.receiptNumber} — ${props.companyName}`,
      html,
      text,
    })

    if (!result.sent) {
      console.warn('[email] sendManualReceiptEmail failed:', result.reason, {
        to: recipient,
        receiptNumber: props.receiptNumber,
      })
    } else {
      console.info('[email] manual receipt sent', {
        to: recipient,
        receiptNumber: props.receiptNumber,
        id: result.id,
      })
    }
    return result
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send failed'
    console.error('[email] sendManualReceiptEmail exception:', reason)
    return { sent: false, reason }
  }
}

/** Simple ride-complete / reservation receipt via plain HTML (reliable on Workers). */
export async function sendReservationReceiptEmail(input: {
  to: string
  customerName: string
  bookingNumber: string
  pickupAddress?: string | null
  dropoffAddress?: string | null
  pickupTimeLabel?: string | null
  vehicleName?: string | null
  chauffeurName?: string | null
  totalAmount?: number | null
  paymentMethod?: string | null
  transactionId?: string | null
  completedAtLabel?: string | null
}): Promise<EmailResult> {
  const to = input.to.trim()
  if (!to || !EMAIL_RE.test(to)) {
    return { sent: false, reason: 'invalid recipient email' }
  }

  const total =
    input.totalAmount != null && Number.isFinite(Number(input.totalAmount))
      ? money(Number(input.totalAmount))
      : null

  const rows: Array<[string, string]> = [
    ['Booking ID', `#${input.bookingNumber}`],
  ]
  if (input.pickupTimeLabel) rows.push(['Date', input.pickupTimeLabel])
  if (input.pickupAddress) rows.push(['From', input.pickupAddress])
  if (input.dropoffAddress) rows.push(['To', input.dropoffAddress])
  if (input.vehicleName) rows.push(['Vehicle', input.vehicleName])
  if (input.chauffeurName) rows.push(['Driver', input.chauffeurName])
  if (total) rows.push(['Total charged', total])
  if (input.paymentMethod) rows.push(['Payment method', input.paymentMethod])
  if (input.transactionId) rows.push(['Transaction ID', input.transactionId])
  if (input.completedAtLabel) rows.push(['Completed on', input.completedAtLabel])

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;color:#6b7280;font-weight:600;font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#111827;font-size:13px;line-height:1.5;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')

  const text = [
    `Dear ${input.customerName},`,
    '',
    'Your Imperial Odyssey payment receipt:',
    ...rows.map(([l, v]) => `${l}: ${v}`),
    '',
    'Thank you for choosing Imperial Odyssey!',
    'Questions? Call 678-478-3506 · phalotrans.com',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;padding:28px 24px;border-radius:8px;">
            <tr>
              <td>
                <h1 style="margin:0 0 16px;font-size:22px;color:#1f2937;">Payment Receipt</h1>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">Dear ${escapeHtml(input.customerName)},</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">
                  Thank you for riding with <strong>Imperial Odyssey</strong>. Here is your receipt.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
                  ${htmlRows}
                </table>
                <p style="margin:0 0 16px;color:#374151;line-height:1.5;">We hope to serve you again soon.</p>
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                  Imperial Odyssey · 678-478-3506 · phalotrans.com
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  try {
    const result = await sendMail({
      to,
      fromKind: 'customer',
      subject: `Payment receipt — Booking #${input.bookingNumber}`,
      html,
      text,
    })
    if (!result.sent) {
      console.warn('[email] sendReservationReceiptEmail failed:', result.reason, {
        to,
        bookingNumber: input.bookingNumber,
      })
    }
    return result
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send failed'
    console.error('[email] sendReservationReceiptEmail exception:', reason)
    return { sent: false, reason }
  }
}
