'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { Appearance } from '@stripe/stripe-js'
import { Loader2, Lock } from 'lucide-react'
import { getStripePromise } from '@/lib/stripe/client'
import { finalizeDeposit } from '@/app/book/actions'

const stripePromise = getStripePromise()

const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#C9A96E',
    colorBackground: '#FAF9F6',
    colorText: '#1A2A44',
    colorDanger: '#B03030',
    borderRadius: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
}

type Props = {
  clientSecret: string
  depositAmount: number
  balanceAmount: number
  bookingNumber: string
  onPaid: () => void
}

export function PaymentStep(props: Props) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance }}>
      <CheckoutForm {...props} />
    </Elements>
  )
}

function CheckoutForm({ depositAmount, balanceAmount, bookingNumber, onPaid }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    // Card only → no redirect; the PaymentIntent already exists (client secret).
    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (confirmErr) {
      setError(confirmErr.message ?? 'Payment failed — please check your card details.')
      setLoading(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      // Verify + finalize server-side (records the deposit, saves the card, sends email).
      const res = await finalizeDeposit(bookingNumber)
      setLoading(false)
      if (res.ok) onPaid()
      else setError(res.error ?? 'Payment captured, but finalizing failed. Please call us.')
    } else {
      setLoading(false)
      setError('Payment could not be completed. Please try another card.')
    }
  }

  return (
    <form onSubmit={pay} className="space-y-6">
      {/* Disclosure — shown BEFORE the customer pays (the consent point). */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Deposit due now (10%)</span>
          <span className="text-on-surface font-semibold">${depositAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-on-surface-variant">Balance after your ride</span>
          <span className="text-on-surface">${balanceAmount.toFixed(2)}</span>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-3 leading-relaxed">
          Your card is saved securely to charge the balance automatically once your ride is
          completed. You&apos;ll receive a receipt for each charge.
        </p>
      </div>

      <PaymentElement />

      {error && (
        <p className="text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-xl">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn-gold w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {loading ? 'Processing…' : `Pay $${depositAmount.toFixed(2)} deposit`}
      </button>
    </form>
  )
}
