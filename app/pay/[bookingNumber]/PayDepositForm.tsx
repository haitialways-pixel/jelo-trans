"use client"

import { useState } from "react"
import { PaymentStep } from "@/components/booking/PaymentStep"

type Props = {
  clientSecret: string
  depositAmount: number
  balanceAmount: number
  bookingNumber: string
}

export function PayDepositForm(props: Props) {
  const [paid, setPaid] = useState(false)

  if (paid) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
        <p className="text-lg font-semibold">Deposit paid</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Your card is saved. The remaining balance is charged when the ride is completed. Nothing else is due right now.
        </p>
      </div>
    )
  }

  return <PaymentStep {...props} onPaid={() => setPaid(true)} />
}
