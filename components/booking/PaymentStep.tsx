'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { Appearance } from '@stripe/stripe-js'
import { Loader2, Lock } from 'lucide-react'
import { getStripePromise } from '@/lib/stripe/client'
import { finalizeDeposit } from '@/app/book/actions'

const stripePromise = getStripePromise()

const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#c5a26f',
    colorBackground: '#0f0f0f',
    colorText: '#ffffff',
    borderRadius: '12px',
    fontFamily: 'Arial, sans-serif',
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
      <div className="rounded-2xl border border-[#c5a26f]/30 bg-[#c5a26f]/5 p-5">
        <div className="flex justify-between text-sm">
          <span className="text-[#a1a1aa]">Deposit due now (10%)</span>
          <span className="text-white font-semibold">${depositAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-[#a1a1aa]">Balance after your ride</span>
          <span className="text-white">${balanceAmount.toFixed(2)}</span>
        </div>
        <p className="text-[11px] text-[#a1a1aa] mt-3 leading-relaxed">
          Your card is saved securely to charge the balance automatically once your ride is
          completed. You&apos;ll receive a receipt for each charge.
        </p>
      </div>

      <PaymentElement />

      {error && (
        <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 p-3 rounded-xl">
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

      <p className="text-center text-[11px] text-[#71717a]">Secured by Stripe · PCI compliant</p>
    </form>
  )
}
