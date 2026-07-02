'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { calculatePrice, createReservation } from '@/app/book/actions'
import { AddressAutocomplete } from './AddressAutocomplete'
import { OptimizedImage } from '@/components/shared/OptimizedImage'

const PaymentStep = dynamic(
  () => import('./PaymentStep').then((m) => ({ default: m.PaymentStep })),
  { ssr: false },
)
import { Clock, MapPin, Navigation, Loader2 } from 'lucide-react'
import {
  DEFAULT_GRATUITY_PERCENT,
  GRATUITY_OPTIONS,
  type GratuityPercent,
} from '@/lib/pricing'
import {
  isPickupTimeValid,
  minPickupDatetimeLocalValue,
  pickupTimeToIso,
  pickupTimeValidationMessage,
} from '@/lib/booking/pickupTime'

const steps = ['Trip Details', 'Select Vehicle', 'Review & Confirm']

export type Vehicle = {
  id: string
  name: string
  capacity: number
  base_price: number
  price_per_mile: number
  image_url: string | null
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-2 border-b border-outline-variant/20 last:border-0">
      <span className="text-on-surface-variant shrink-0 font-medium">{label}</span>
      <span className="text-on-surface text-right font-semibold">{value}</span>
    </div>
  )
}

export function BookingWizard({ vehicles }: { vehicles: Vehicle[] }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<any>({
    passengers: 2,
    luggage: 2,
    gratuityPercent: DEFAULT_GRATUITY_PERCENT,
  })
  const [price, setPrice] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [bookingNumber, setBookingNumber] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')
  // Stripe deposit flow
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState(0)
  const [balanceAmount, setBalanceAmount] = useState(0)
  const [paid, setPaid] = useState(false)

  const updateForm = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const refreshPrice = async (gratuityPercent?: GratuityPercent) => {
    if (!formData.vehicleId) return
    const percent = gratuityPercent ?? formData.gratuityPercent ?? DEFAULT_GRATUITY_PERCENT
    const result = await calculatePrice({
      vehicleId: formData.vehicleId,
      distanceMiles: Number(formData.distanceMiles || 0),
      pickupTime: formData.pickupTime,
      durationHours: Number(formData.durationHours),
      gratuityPercent: percent,
    })
    if (!result.error) setPrice(result)
    return result
  }

  const selectGratuity = async (percent: GratuityPercent) => {
    updateForm('gratuityPercent', percent)
    if (currentStep !== 2) return
    setLoading(true)
    const result = await refreshPrice(percent)
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  const validateStep = (step: number): boolean => {
    setError('')

    if (step === 0) {
      if (!formData.pickupAddress?.trim()) return setError('Pickup Address is required'), false
      if (!formData.dropoffAddress?.trim()) return setError('Dropoff Address is required'), false
      if (!formData.pickupTime) return setError('Pickup Date & Time is required'), false
    }
    if (step === 1) {
      if (!formData.vehicleId) return setError('Please select a vehicle'), false
    }
    if (step === 2) {
      if (!isPickupTimeValid(formData.pickupTime)) {
        return setError(pickupTimeValidationMessage()), false
      }
      if (!formData.customerName?.trim()) return setError('Full Name is required'), false
      if (!formData.customerEmail?.trim()) return setError('Email is required'), false
      if (!formData.customerPhone?.trim()) return setError('Phone Number is required'), false
    }
    return true
  }

  const nextStep = async () => {
    if (!validateStep(currentStep)) return

    // Transitioning from Step 0 (Details) to Step 1 (Select Vehicle)
    if (currentStep === 0) {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/places/distance?pickup=${encodeURIComponent(
            formData.pickupAddress
          )}&dropoff=${encodeURIComponent(formData.dropoffAddress)}`
        )
        const data = await res.json()

        if (data.error) {
          setError(data.error)
          setLoading(false)
          return
        }

        // Apply Formule A: 1h minimum, then round up extra minutes to nearest 15-minute block
        const durationMins = data.durationMinutes
        let billingHours = 1.0

        if (durationMins > 60) {
          const extraMins = durationMins - 60
          const extraBlocks = Math.ceil(extraMins / 15)
          billingHours = 1.0 + extraBlocks * 0.25
        }

        setFormData((prev: any) => ({
          ...prev,
          durationHours: billingHours,
          calculatedMinutes: durationMins,
          distanceMiles: data.distanceMiles,
          durationText: data.durationText,
          distanceText: data.distanceText,
        }))

        // Reset vehicle selection if they changed the route
        updateForm('vehicleId', null)
        setCurrentStep(1)
      } catch (err) {
        console.error(err)
        setError('Failed to calculate travel distance and duration. Please verify the addresses.')
      } finally {
        setLoading(false)
      }
      return
    }

    // Transitioning from Step 1 (Vehicle) to Step 2 (Review)
    if (currentStep === 1 && formData.vehicleId) {
      setLoading(true)
      const result = await refreshPrice()
      setLoading(false)

      if (result?.error) {
        setError(result.error)
        return
      }
      setCurrentStep(currentStep + 1)
      return
    }

    // Finalizing Reservation (Step 2 -> booking creation)
    if (currentStep === 2) {
      const pickupTimeIso = pickupTimeToIso(formData.pickupTime)
      if (!pickupTimeIso || !isPickupTimeValid(formData.pickupTime)) {
        setError(pickupTimeValidationMessage())
        return
      }

      setLoading(true)
      const result: any = await createReservation({
        ...formData,
        pickupTimeIso,
        pickupTimezoneOffset: new Date().getTimezoneOffset(),
        vehicleName: price?.vehicleName,
        durationHours: Number(formData.durationHours),
      })
      setLoading(false)

      if (result.success) {
        setBookingNumber(result.bookingNumber)
        setEmailSent(Boolean(result.emailSent))
        if (result.requiresPayment && result.clientSecret) {
          setClientSecret(result.clientSecret)
          setDepositAmount(Number(result.depositAmount ?? 0))
          setBalanceAmount(Number(result.balanceAmount ?? 0))
        }
        if (result.error) {
          setError(result.error)
        } else if (!result.emailSent && result.emailError) {
          setError(
            `Your booking is saved, but we could not email you (${result.emailError}). ` +
              'Please save your booking number — our team has been notified.',
          )
        }
      } else {
        setError(result.error || 'Failed to create booking')
      }
      return
    }

    setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    setError('')
    setCurrentStep(Math.max(0, currentStep - 1))
  }

  const getVehiclePriceQuote = (basePrice: number, pricePerMile: number) => {
    const miles = Number(formData.distanceMiles || 0)
    const base = Math.round((basePrice + miles * pricePerMile) * 100) / 100
    return base.toFixed(2)
  }

  // Deposit payment step (Stripe on): reservation created, awaiting the 10% deposit.
  if (bookingNumber && clientSecret && !paid) {
    return (
      <div className="card p-8 md:p-10 max-w-lg mx-auto">
        <h2 className="text-3xl tracking-tight mb-1">Secure your reservation</h2>
        <p className="text-on-surface-variant text-sm mb-6">
          Booking <span className="font-mono text-primary">{bookingNumber}</span> — a 10% deposit
          confirms it.
          {emailSent && (
            <span className="block mt-2 text-emerald-400/90">
              A booking received email was sent to {formData.customerEmail}.
            </span>
          )}
        </p>
        <PaymentStep
          clientSecret={clientSecret}
          depositAmount={depositAmount}
          balanceAmount={balanceAmount}
          bookingNumber={bookingNumber}
          onPaid={() => setPaid(true)}
        />
      </div>
    )
  }

  if (bookingNumber && (!clientSecret || paid)) {
    const formatPickup = (v: string) => {
      try {
        return new Date(v).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
      } catch {
        return v
      }
    }
    return (
      <div className="card p-10 max-w-lg mx-auto">
        <div className="text-center">
          <div className="text-6xl mb-6 text-primary">✓</div>
          <h2 className="text-4xl tracking-tight mb-2">Booking Received!</h2>
          <p className="text-on-surface-variant text-sm mb-4">
            Your reservation request is registered. A manager will review it and send a confirmation shortly.
          </p>
          <p className="text-primary text-3xl font-mono mb-8">{bookingNumber}</p>
        </div>

        <div className="border-t border-outline-variant/30 pt-6 space-y-2 text-sm">
          <SummaryRow label="Name" value={formData.customerName} />
          <SummaryRow label="Pickup Time" value={formatPickup(formData.pickupTime)} />
          <SummaryRow label="Pickup" value={formData.pickupAddress} />
          <SummaryRow label="Dropoff" value={formData.dropoffAddress} />
          {price?.vehicleName && <SummaryRow label="Vehicle" value={price.vehicleName} />}
          <SummaryRow label="Distance" value={formData.distanceText || `${formData.distanceMiles} mi`} />
          <SummaryRow label="Travel Time" value={formData.durationText} />
          {price?.basePrice != null && (
            <SummaryRow label="Trip fare" value={`$${Number(price.basePrice).toFixed(2)}`} />
          )}
          {price?.gratuityAmount != null && price.gratuityPercent != null && (
            <SummaryRow
              label={`Gratuity (${price.gratuityPercent}%)`}
              value={`$${Number(price.gratuityAmount).toFixed(2)}`}
            />
          )}
          {price?.total != null && (
            <SummaryRow label="Estimated Total" value={`$${Number(price.total).toFixed(2)}`} />
          )}
          {paid && depositAmount > 0 && (
            <SummaryRow label="Deposit paid (10%)" value={`$${depositAmount.toFixed(2)}`} />
          )}
          {paid && balanceAmount > 0 && (
            <SummaryRow label="Balance after ride" value={`$${balanceAmount.toFixed(2)}`} />
          )}
        </div>

        <p className="text-on-surface-variant text-sm mt-6 border-t border-outline-variant/30 pt-6">
          {paid
            ? `Your 10% deposit is paid — the balance is charged automatically after your ride. `
            : ''}
          {emailSent
            ? `A booking received email is on its way to ${formData.customerEmail}. You will receive a separate confirmation once our team approves your reservation. `
            : ''}
          Keep your booking number safe — you will need it together with your phone number to view or
          cancel your booking.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Wizard Progress Indicator */}
      <div className="flex justify-center items-center gap-4 mb-10">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold border transition ${
                i === currentStep
                  ? 'bg-primary text-background border-primary'
                  : i < currentStep
                    ? 'bg-primary/20 text-primary border-primary'
                    : 'bg-transparent text-on-surface-variant border-outline-variant/30'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`ml-2 text-sm font-medium hidden sm:inline ${
                i === currentStep ? 'text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="w-12 h-[1px] bg-outline-variant/30 mx-4 hidden sm:block" />
            )}
          </div>
        ))}
      </div>

      <div className="card luxe-card p-8 md:p-12 relative overflow-hidden shadow-lg shadow-primary/5">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-primary font-semibold text-lg tracking-wider">
              {currentStep === 0 ? 'CALCULATING ROUTE...' : 'PROCESSING...'}
            </p>
          </div>
        )}

        {currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight text-on-surface mb-6">Trip Details</h2>
            
            <div className="space-y-1">
              <label className="text-xs text-primary uppercase tracking-wider font-semibold ml-1">Pickup Address *</label>
              <AddressAutocomplete
                placeholder="Enter pickup address, airport, hotel..."
                value={formData.pickupAddress || ''}
                onChange={(v) => updateForm('pickupAddress', v)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-primary uppercase tracking-wider font-semibold ml-1">Dropoff Address *</label>
              <AddressAutocomplete
                placeholder="Enter dropoff destination..."
                value={formData.dropoffAddress || ''}
                onChange={(v) => updateForm('dropoffAddress', v)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <label className="text-xs text-primary uppercase tracking-wider font-semibold mb-2 ml-1">Pickup Date & Time *</label>
                <input
                  type="datetime-local"
                  min={minPickupDatetimeLocalValue()}
                  value={formData.pickupTime || ''}
                  onChange={(e) => updateForm('pickupTime', e.target.value)}
                  className="w-full p-4 rounded-2xl bg-card border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs text-primary uppercase tracking-wider font-semibold mb-2 ml-1">Passengers</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={formData.passengers}
                    className="p-4 rounded-2xl bg-card border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    onChange={(e) => updateForm('passengers', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-primary uppercase tracking-wider font-semibold mb-2 ml-1">Luggage</label>
                  <input
                    type="number"
                    min="0"
                    max="14"
                    value={formData.luggage}
                    className="p-4 rounded-2xl bg-card border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    onChange={(e) => updateForm('luggage', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-primary uppercase tracking-wider font-semibold mb-2 ml-1">Special Requests (optional)</label>
              <textarea
                placeholder="Child seats, flight numbers, specific route preferences..."
                className="w-full p-4 rounded-2xl bg-card border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none"
                onChange={(e) => updateForm('specialRequests', e.target.value)}
                value={formData.specialRequests || ''}
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-on-surface">Choose Your Vehicle</h2>
                <p className="text-sm text-on-surface-variant mt-1">Select from our luxury Orlando fleet</p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-6 text-sm">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-primary" />
                  <span>{formData.distanceText}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{formData.durationText}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-primary" />
                  <span>Distance: {formData.distanceText}</span>
                </div>
              </div>
            </div>

            {vehicles.length === 0 ? (
              <p className="text-on-surface-variant">No vehicles are currently available online. Please contact us directly to arrange your trip.</p>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {vehicles.map((v) => {
                  const isSelected = formData.vehicleId === v.id
                  const calculatedTotal = getVehiclePriceQuote(v.base_price, v.price_per_mile)

                  return (
                    <div
                      key={v.id}
                      onClick={() => updateForm('vehicleId', v.id)}
                      className={`card p-4 cursor-pointer hover:ring-2 hover:ring-primary transition flex flex-col justify-between ${
                        isSelected ? 'ring-2 ring-primary bg-primary/10' : 'border border-outline-variant/20'
                      }`}
                    >
                      <div>
                        <div className="relative rounded-xl overflow-hidden mb-4 aspect-video">
                          <OptimizedImage
                            src={v.image_url ?? '/images/fleet-overview.webp'}
                            alt={v.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 280px"
                            className="object-cover"
                          />
                        </div>
                        <div className="font-semibold text-lg text-on-surface">{v.name}</div>
                        <div className="text-xs text-on-surface-variant mt-1">
                          Up to {v.capacity} passengers · ${v.base_price} base + ${v.price_per_mile}/mi
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-outline-variant/20 flex justify-between items-end">
                        <span className="text-xs text-on-surface-variant font-medium mb-0.5">Est. Total</span>
                        <div className="text-right">
                          <span className="text-xl font-bold text-primary">${calculatedTotal}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && price && (
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-on-surface mb-6">Review & Confirm</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 space-y-4">
                  <h3 className="text-xs text-primary uppercase tracking-wider font-semibold border-b border-outline-variant/30 pb-2">Route Details</h3>
                  <div className="flex gap-3">
                    <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-on-surface-variant block uppercase">From</span>
                      <span className="text-on-surface text-sm font-semibold">{formData.pickupAddress}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-on-surface-variant block uppercase">To</span>
                      <span className="text-on-surface text-sm font-semibold">{formData.dropoffAddress}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-center text-xs">
                    <div className="bg-surface-container-low p-3 rounded-xl">
                      <span className="text-on-surface-variant block">Distance</span>
                      <span className="text-on-surface font-bold block mt-1">{formData.distanceText}</span>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-xl">
                      <span className="text-on-surface-variant block">Est. Time</span>
                      <span className="text-on-surface font-bold block mt-1">{formData.durationText}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-outline-variant/25 shadow-sm space-y-3">
                  <h3 className="text-xs text-primary uppercase tracking-wider font-semibold border-b border-outline-variant/20 pb-2">
                    Price Summary
                  </h3>
                  <SummaryRow label="Trip fare" value={`$${price.basePrice.toFixed(2)}`} />

                  <div>
                    <p className="text-xs text-primary uppercase tracking-wider font-semibold mb-2">
                      Gratuity for your chauffeur
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {GRATUITY_OPTIONS.map((pct) => {
                        const selected = formData.gratuityPercent === pct
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => selectGratuity(pct)}
                            className={`rounded-xl border py-3 text-sm font-semibold transition ${
                              selected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                : 'border-outline-variant/30 bg-card text-on-surface-variant hover:border-primary/40'
                            }`}
                          >
                            {pct}%
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <SummaryRow
                    label={`Gratuity (${price.gratuityPercent ?? formData.gratuityPercent}%)`}
                    value={`$${Number(price.gratuityAmount ?? 0).toFixed(2)}`}
                  />
                  <div className="flex justify-between items-center pt-3 border-t border-primary/15 text-xl font-bold">
                    <span className="text-on-surface">Estimated Total</span>
                    <span className="text-primary">${price.total.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant text-right">
                    Fare includes tolls and taxes · gratuity goes to your chauffeur
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-on-surface mb-4">Contact Information</h3>
            <div className="flex flex-col gap-4 max-w-md">
              <input
                type="text"
                placeholder="Full Name *"
                value={formData.customerName || ''}
                className="p-4 rounded-2xl bg-card border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                onChange={(e) => updateForm('customerName', e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email Address *"
                value={formData.customerEmail || ''}
                className="p-4 rounded-2xl bg-card border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                onChange={(e) => updateForm('customerEmail', e.target.value)}
                required
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                value={formData.customerPhone || ''}
                className="p-4 rounded-2xl bg-card border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                onChange={(e) => updateForm('customerPhone', e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-700 mt-6 text-center font-medium bg-red-50 p-4 rounded-2xl border border-red-200">
            {error}
          </p>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-10 pt-8 border-t border-outline-variant/30">
          <button
            onClick={prevStep}
            disabled={currentStep === 0 || loading}
            className="px-8 py-3 disabled:opacity-40 border border-outline-variant/30 text-on-surface rounded-full hover:bg-surface-container-lowest transition"
          >
            Back
          </button>
          <button
            onClick={nextStep}
            disabled={loading}
            className="btn-gold px-12 py-4 rounded-full font-semibold transition"
          >
            {loading ? 'Processing...' : currentStep === 2 ? 'Confirm Booking' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
