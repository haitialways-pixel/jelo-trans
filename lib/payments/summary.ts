/** Shared collected / due math for manager UI and customer emails. */

export type PaymentInputs = {
  totalPrice: number | null | undefined
  fareSubtotal?: number | null
  gratuityPercent?: number | null
  gratuityAmount?: number | null
  durationHours?: number | null
  distanceMiles?: number | null
  specialRequests?: string | null
  paymentStatus?: string | null
  depositAmount?: number | null
  balanceAmount?: number | null
  depositPaidAt?: string | null
  balancePaidAt?: string | null
}

export type PaymentSummary = {
  fareSubtotal: number | null
  gratuityPercent: number | null
  gratuityAmount: number | null
  total: number
  isCharter: boolean
  charterHours: number | null
  charterHourlyRate: number | null
  distanceMiles: number | null
  /** A deposit amount was stored (Stripe 10% intent), whether or not it was paid. */
  depositScheduled: boolean
  /** Customer actually paid a deposit. */
  depositCollected: boolean
  depositAmount: number
  depositPaid: boolean
  balanceAmount: number
  balancePaid: boolean
  collected: number
  amountDue: number
  fullyPaid: boolean
}

function money(n: number): number {
  return Math.round(n * 100) / 100
}

export function isCharterBooking(specialRequests?: string | null): boolean {
  return Boolean(specialRequests?.trim().startsWith('Trip type: Charter'))
}

export function summarizePayment(input: PaymentInputs): PaymentSummary {
  const total = money(Number(input.totalPrice ?? 0))
  const fareSubtotal =
    input.fareSubtotal == null || Number.isNaN(Number(input.fareSubtotal))
      ? null
      : money(Number(input.fareSubtotal))
  const gratuityPercent =
    input.gratuityPercent == null || Number.isNaN(Number(input.gratuityPercent))
      ? null
      : Number(input.gratuityPercent)
  const gratuityAmount =
    input.gratuityAmount == null || Number.isNaN(Number(input.gratuityAmount))
      ? null
      : money(Number(input.gratuityAmount))

  const isCharter = isCharterBooking(input.specialRequests)
  const durationHours =
    input.durationHours != null && Number(input.durationHours) > 0
      ? Number(input.durationHours)
      : null
  const charterHours = isCharter ? durationHours : null
  const charterHourlyRate =
    isCharter && fareSubtotal != null && charterHours && charterHours > 0
      ? money(fareSubtotal / charterHours)
      : null

  const depositAmount = money(Math.max(0, Number(input.depositAmount ?? 0)))
  const depositPaid = Boolean(input.depositPaidAt)
  const depositScheduled = depositAmount > 0
  const depositCollected = depositPaid && depositAmount > 0

  const fullyPaid = input.paymentStatus === 'paid' || Boolean(input.balancePaidAt)
  const balancePaid = fullyPaid
  const storedBalance = money(Math.max(0, Number(input.balanceAmount ?? 0)))
  const balanceAmount =
    storedBalance > 0 ? storedBalance : money(Math.max(0, total - depositAmount))

  let collected = 0
  if (fullyPaid) {
    collected = total
  } else {
    collected = money((depositCollected ? depositAmount : 0) + (balancePaid ? balanceAmount : 0))
  }
  const amountDue = fullyPaid ? 0 : money(Math.max(0, total - collected))

  return {
    fareSubtotal,
    gratuityPercent,
    gratuityAmount,
    total,
    isCharter,
    charterHours,
    charterHourlyRate,
    distanceMiles:
      input.distanceMiles == null || Number(input.distanceMiles) <= 0
        ? null
        : Number(input.distanceMiles),
    depositScheduled,
    depositCollected,
    depositAmount,
    depositPaid,
    balanceAmount,
    balancePaid,
    collected,
    amountDue,
    fullyPaid,
  }
}

export function paymentRows(s: PaymentSummary): Array<[string, string]> {
  const rows: Array<[string, string]> = []
  if (s.isCharter && s.charterHours != null && s.charterHourlyRate != null) {
    rows.push([
      'Charter',
      `${s.charterHours}h × $${s.charterHourlyRate.toFixed(2)}/hr`,
    ])
  }
  if (s.fareSubtotal != null) rows.push(['Trip fare', `$${s.fareSubtotal.toFixed(2)}`])
  if (s.gratuityAmount != null && s.gratuityPercent != null) {
    rows.push([`Gratuity (${s.gratuityPercent}%)`, `$${s.gratuityAmount.toFixed(2)}`])
  }
  rows.push(['Total fare', `$${s.total.toFixed(2)}`])
  if (s.depositCollected) {
    rows.push(['Deposit paid', `$${s.depositAmount.toFixed(2)}`])
  } else if (s.depositScheduled) {
    rows.push(['Deposit (not collected)', `$${s.depositAmount.toFixed(2)}`])
  } else {
    rows.push(['Deposit', 'No deposit taken'])
  }
  rows.push(['Amount paid', `$${s.collected.toFixed(2)}`])
  rows.push(['Total amount due', `$${s.amountDue.toFixed(2)}`])
  return rows
}
