// Plain HTML vendor invoice email — same reliability path as manual receipts
// (no @react-email/render; safer on Cloudflare Workers).
import { sendMail } from './mailer'
import { EMAIL_RE, fmtMoney } from './format'

export type EmailResult = { sent: boolean; reason?: string; id?: string }

export type InvoiceLineItem = {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type InvoicePaymentMethod = 'ach' | 'zelle' | 'credit_card'

export type VendorInvoiceEmailProps = {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  tripType?: 'one_way' | 'round_trip' | 'charter'
  /** Hours for charter / as-directed service. */
  durationHours?: number
  vendorName: string
  vendorCompany?: string
  vendorEmail?: string
  vendorPhone?: string
  origin?: string
  destination?: string
  departureDateTime?: string
  returnDateTime?: string
  bookingTicketNumber?: string
  items: InvoiceLineItem[]
  subtotal: number
  taxLabel?: string
  taxAmount: number
  discountAmount: number
  otherFees: number
  otherFeesLabel?: string
  amountDue: number
  notes?: string
  /** Which payment options to show on the invoice */
  acceptedMethods: InvoicePaymentMethod[]
  achInstructions?: string
  zelleInstructions?: string
  cardInstructions?: string
  cardPaymentLink?: string
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

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  ach: 'ACH / Bank transfer',
  zelle: 'Zelle',
  credit_card: 'Credit card',
}

function buildInvoiceContent(props: VendorInvoiceEmailProps): {
  html: string
  text: string
} {
  const tripLabel =
    props.tripType === 'round_trip'
      ? 'Round Trip'
      : props.tripType === 'charter'
        ? 'Charter / As-directed'
        : props.tripType === 'one_way'
          ? 'One-Way'
          : undefined

  const companyLine = [props.companyPhone, props.companyEmail, props.companyWebsite]
    .filter(Boolean)
    .join(' · ')

  const billTo = [props.vendorName, props.vendorCompany].filter(Boolean).join(' · ')
  const vendorContact = [props.vendorEmail, props.vendorPhone].filter(Boolean).join(' · ')
  const durationLabel =
    props.durationHours != null && props.durationHours > 0
      ? `${props.durationHours} hour${props.durationHours === 1 ? '' : 's'}`
      : undefined

  // ---- plain text ----
  const textLines: string[] = [
    `Invoice #${props.invoiceNumber}`,
    props.companyName,
    props.companyAddress || '',
    companyLine,
    '',
    `Invoice date: ${props.invoiceDate}`,
    props.dueDate ? `Due date: ${props.dueDate}` : '',
    tripLabel ? `Trip type: ${tripLabel}` : '',
    durationLabel ? `Duration: ${durationLabel}` : '',
    `Bill to: ${billTo}`,
    vendorContact,
    props.bookingTicketNumber ? `Booking / ticket #: ${props.bookingTicketNumber}` : '',
    '',
  ]

  if (
    props.origin ||
    props.destination ||
    props.departureDateTime ||
    props.returnDateTime ||
    durationLabel
  ) {
    textLines.push('Trip details')
    if (props.origin) textLines.push(`From: ${props.origin}`)
    if (props.destination) {
      textLines.push(
        props.tripType === 'charter'
          ? `Service area / notes: ${props.destination}`
          : `To: ${props.destination}`,
      )
    }
    if (props.departureDateTime) textLines.push(`Start: ${props.departureDateTime}`)
    if (props.returnDateTime) textLines.push(`Return: ${props.returnDateTime}`)
    if (durationLabel) textLines.push(`Duration: ${durationLabel}`)
    textLines.push('')
  }

  textLines.push('Line items')
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
  textLines.push(`Amount due: ${money(props.amountDue)}`)
  textLines.push('')

  if (props.acceptedMethods.length > 0) {
    textLines.push('Payment options')
    for (const method of props.acceptedMethods) {
      textLines.push(`• ${METHOD_LABELS[method]}`)
      if (method === 'ach' && props.achInstructions) {
        textLines.push(`  ${props.achInstructions}`)
      }
      if (method === 'zelle' && props.zelleInstructions) {
        textLines.push(`  ${props.zelleInstructions}`)
      }
      if (method === 'credit_card') {
        if (props.cardInstructions) textLines.push(`  ${props.cardInstructions}`)
        if (props.cardPaymentLink) textLines.push(`  Pay online: ${props.cardPaymentLink}`)
      }
    }
    textLines.push('')
  }

  if (props.notes?.trim()) {
    textLines.push('Notes')
    textLines.push(props.notes.trim())
    textLines.push('')
  }

  textLines.push(`Please include invoice #${props.invoiceNumber} with your payment.`)
  textLines.push(`Questions? ${props.companyPhone || '678-478-3506'} · ${props.companyWebsite || 'phalotrans.com'}`)

  const text = textLines.filter((l) => l !== undefined && l !== '').join('\n')

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

  const metaRows: Array<[string, string]> = [['Invoice date', props.invoiceDate]]
  if (props.dueDate) metaRows.push(['Due date', props.dueDate])
  if (tripLabel) metaRows.push(['Trip type', tripLabel])
  if (durationLabel) metaRows.push(['Duration', durationLabel])
  metaRows.push(['Bill to', billTo])
  if (vendorContact) metaRows.push(['Contact', vendorContact])
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
  if (props.destination) {
    journeyRows.push([
      props.tripType === 'charter' ? 'Service area / notes' : 'To',
      props.destination,
    ])
  }
  if (props.departureDateTime) {
    journeyRows.push([
      props.tripType === 'charter' ? 'Start' : 'Departure',
      props.departureDateTime,
    ])
  }
  if (props.returnDateTime) journeyRows.push(['Return', props.returnDateTime])
  if (durationLabel) journeyRows.push(['Duration', durationLabel])
  const journeyHtml =
    journeyRows.length > 0
      ? `<h3 style="margin:20px 0 8px;font-size:15px;color:#1f2937;">Trip details</h3>
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
  totalRows.push(['Amount due', money(props.amountDue)])

  const totalsHtml = totalRows
    .map(([label, value], i) => {
      const last = i === totalRows.length - 1
      return `<tr>
          <td style="padding:${last ? '10px' : '4px'} 0;color:${last ? '#111827' : '#4b5563'};font-size:${last ? '15px' : '13px'};font-weight:${last ? 700 : 400};">${escapeHtml(label)}</td>
          <td style="padding:${last ? '10px' : '4px'} 0;color:${last ? '#b45309' : '#111827'};font-size:${last ? '15px' : '13px'};font-weight:${last ? 700 : 400};text-align:right;">${escapeHtml(value)}</td>
        </tr>`
    })
    .join('')

  const paymentBlocks = props.acceptedMethods
    .map((method) => {
      let detail = ''
      if (method === 'ach' && props.achInstructions) {
        detail = escapeHtml(props.achInstructions).replace(/\n/g, '<br />')
      } else if (method === 'zelle' && props.zelleInstructions) {
        detail = escapeHtml(props.zelleInstructions).replace(/\n/g, '<br />')
      } else if (method === 'credit_card') {
        const parts: string[] = []
        if (props.cardInstructions) {
          parts.push(escapeHtml(props.cardInstructions).replace(/\n/g, '<br />'))
        }
        if (props.cardPaymentLink) {
          const href = escapeHtml(props.cardPaymentLink)
          parts.push(
            `<a href="${href}" style="color:#b45309;font-weight:600;text-decoration:underline;">Pay by card online</a>`,
          )
        }
        detail = parts.join('<br />')
      }
      return `<div style="margin:0 0 12px;padding:12px 14px;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;">${escapeHtml(METHOD_LABELS[method])}</p>
        ${detail ? `<p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">${detail}</p>` : `<p style="margin:0;font-size:12px;color:#6b7280;">Contact us for ${escapeHtml(METHOD_LABELS[method]).toLowerCase()} details.</p>`}
      </div>`
    })
    .join('')

  const paymentHtml =
    props.acceptedMethods.length > 0
      ? `<h3 style="margin:20px 0 10px;font-size:15px;color:#1f2937;">How to pay</h3>${paymentBlocks}`
      : ''

  const notesHtml = props.notes?.trim()
    ? `<h3 style="margin:20px 0 8px;font-size:15px;color:#1f2937;">Notes</h3>
       <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;white-space:pre-wrap;">${escapeHtml(props.notes.trim())}</p>`
    : ''

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;padding:28px 24px;border-radius:8px;">
            <tr>
              <td>
                <h1 style="margin:0 0 4px;font-size:22px;color:#1f2937;">Invoice</h1>
                <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Invoice #${escapeHtml(props.invoiceNumber)}</p>

                <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(props.companyName)}</p>
                ${props.companyAddress ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(props.companyAddress)}</p>` : ''}
                ${companyLine ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(companyLine)}</p>` : ''}

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                  ${metaHtml}
                </table>

                ${journeyHtml}

                <h3 style="margin:20px 0 8px;font-size:15px;color:#1f2937;">Line items</h3>
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

                ${paymentHtml}
                ${notesHtml}

                <p style="margin:24px 0 0;color:#374151;font-size:14px;line-height:1.5;">
                  Please include invoice <strong>#${escapeHtml(props.invoiceNumber)}</strong> with your payment.
                  Thank you for your business.
                </p>
                <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                  ${escapeHtml(props.companyName)} · ${escapeHtml(props.companyPhone || '678-478-3506')} · ${escapeHtml(props.companyWebsite || 'phalotrans.com')}<br />
                  This is a transactional invoice for services rendered.
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

export async function sendVendorInvoiceEmail(
  to: string,
  props: VendorInvoiceEmailProps,
): Promise<EmailResult> {
  const recipient = to.trim()
  if (!recipient || !EMAIL_RE.test(recipient)) {
    return { sent: false, reason: 'invalid recipient email' }
  }

  try {
    const { html, text } = buildInvoiceContent(props)
    const result = await sendMail({
      to: recipient,
      fromKind: 'customer',
      subject: `Invoice ${props.invoiceNumber} — ${props.companyName} · ${money(props.amountDue)} due`,
      html,
      text,
    })

    if (!result.sent) {
      console.warn('[email] sendVendorInvoiceEmail failed:', result.reason, {
        to: recipient,
        invoiceNumber: props.invoiceNumber,
      })
    } else {
      console.info('[email] vendor invoice sent', {
        to: recipient,
        invoiceNumber: props.invoiceNumber,
        id: result.id,
      })
    }
    return result
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send failed'
    console.error('[email] sendVendorInvoiceEmail exception:', reason)
    return { sent: false, reason }
  }
}
