import { notFound } from "next/navigation"
import { isBookingNumber, normalizeBookingNumber } from "@/lib/bookingNumber"
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin"
import { isStripeConfigured } from "@/lib/stripe/server"
import { createDepositForBooking } from "@/lib/stripe/payments"
import { BRAND_NAME, BRAND_PHONE_DISPLAY } from "@/lib/site"
import { PayDepositForm } from "./PayDepositForm"

export const dynamic = "force-dynamic"

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="text-xs tracking-widest text-on-surface-variant uppercase">{BRAND_NAME}</p>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">{body}</p>
    </main>
  )
}

export default async function PayDepositPage({
  params,
}: {
  params: Promise<{ bookingNumber: string }>
}) {
  const { bookingNumber: raw } = await params
  const bookingNumber = normalizeBookingNumber(decodeURIComponent(raw))
  if (!isBookingNumber(bookingNumber)) notFound()

  if (!isStripeConfigured() || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <Notice
        title="Card payment is not available"
        body={`Stripe is not configured, so this deposit was not charged and no card was saved. Call ${BRAND_PHONE_DISPLAY} and we will take payment another way.`}
      />
    )
  }

  if (!isAdminConfigured()) {
    return (
      <Notice
        title="Card payment is not available"
        body={`We could not open this booking to charge the deposit. Nothing was charged. Call ${BRAND_PHONE_DISPLAY}.`}
      />
    )
  }

  const admin = createAdminClient()
  const { data: reservation, error } = await admin
    .from("reservations")
    .select("status, deposit_paid_at, customer_name")
    .eq("booking_number", bookingNumber)
    .maybeSingle()

  if (error || !reservation) notFound()

  if (reservation.status === "cancelled") {
    return (
      <Notice
        title="This booking is cancelled"
        body="No deposit was charged from this page."
      />
    )
  }

  if (reservation.status === "pending") {
    return (
      <Notice
        title="Waiting for confirmation"
        body={`Booking ${bookingNumber} is not confirmed yet, so nothing is charged. After we confirm it, this link collects the 25% deposit and saves the card.`}
      />
    )
  }

  if (reservation.deposit_paid_at) {
    return (
      <Notice
        title="Deposit already paid"
        body="Your card is already saved. The balance is charged when the ride is completed."
      />
    )
  }

  try {
    const deposit = await createDepositForBooking(bookingNumber)
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-xs tracking-widest text-on-surface-variant uppercase">{BRAND_NAME}</p>
        <h1 className="mt-2 text-2xl font-semibold">Pay the 25% deposit</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {reservation.customer_name ? `${reservation.customer_name} · ` : ""}
          Booking {bookingNumber}. This saves the card for the balance after the ride. Submitting the original reservation did not charge you.
        </p>
        <div className="mt-6">
          <PayDepositForm
            clientSecret={deposit.clientSecret}
            depositAmount={deposit.depositAmount}
            balanceAmount={deposit.balanceAmount}
            bookingNumber={bookingNumber}
          />
        </div>
      </main>
    )
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Stripe did not start the payment."
    return (
      <Notice
        title="Deposit was not charged"
        body={`${detail} Nothing was marked paid. Call ${BRAND_PHONE_DISPLAY} if you need help.`}
      />
    )
  }
}
