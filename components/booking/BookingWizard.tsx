'use client'

import { useState } from 'react'
import { useLoadScript } from '@react-google-maps/api'
import { calculatePrice, createReservation } from '@/app/book/actions'
import { PaymentStep } from './PaymentStep'
import { AddressAutocomplete } from './AddressAutocomplete'
import { Clock, MapPin, Navigation, Loader2 } from 'lucide-react'

const libraries = ['places'] as const

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
    <div className="flex justify-between gap-6 py-2 border-b border-white/5 last:border-0">
      <span className="text-[#a1a1aa] shrink-0 font-medium">{label}</span>
      <span className="text-white text-right font-semibold">{value}</span>
    </div>
  )
}

export function BookingWizard({ vehicles }: { vehicles: Vehicle[] }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  })

  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<any>({
    passengers: 2,
    luggage: 2,
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

  const getMinDateTime = () => {
    const now = new Date()
    const futureNow = new Date(now.getTime() + 30 * 60 * 1000)
    const tzOffset = futureNow.getTimezoneOffset() * 60000
    return new Date(futureNow.getTime() - tzOffset).toISOString().slice(0, 16)
  }

  const validateStep = (step: number): boolean => {
    setError('')
    if (step === 0) {
      if (!formData.pickupAddress?.trim()) return setError('Pickup Address is required'), false
      if (!formData.dropoffAddress?.trim()) return setError('Dropoff Address is required'), false
      if (!formData.pickupTime) return setError('Pickup Date & Time is required'), false
      const chosen = new Date(formData.pickupTime)
      if (chosen <= new Date()) {
        return setError('Pickup time must be in the future (minimum 30 minutes from now)'), false
      }
    }
    if (step === 1) {
      if (!formData.vehicleId) return setError('Please select a vehicle'), false
    }
    if (step === 2) {
      if (!formData.customerName?.trim()) return setError('Full Name is required'), false
      if (!formData.customerEmail?.trim()) return setError('Email is required'), false
      if (!formData.customerPhone?.trim()) return setError('Phone Number is required'), false
    }
    return true
  }

  const nextStep = async () => {
    if (!validateStep(currentStep)) return

    if (currentStep === 0) {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/places/distance?pickup=${encodeURIComponent(formData.pickupAddress)}&dropoff=${encodeURIComponent(formData.dropoffAddress)}`
        )
        const data = await res.json()
        if (data.error) {
          setError(data.error)
          setLoading(false)
          return
        }

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

        updateForm('vehicleId', null)
        setCurrentStep(1)
      } catch (err) {
        console.error(err)
        setError('Failed to calculate travel distance and duration.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (currentStep === 1 && formData.vehicleId) {
      setLoading(true)
      const result = await calculatePrice({
        vehicleId: formData.vehicleId,
        distanceMiles: Number(formData.distanceMiles || 0),
      })
      setLoading(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setPrice(result)
      setCurrentStep(currentStep + 1)
      return
    }

    if (currentStep === 2) {
      setLoading(true)
      const result: any = await createReservation({
        ...formData,
        vehicleName: price?.vehicleName,
        durationHours: Number(formData.durationHours),
      })
      setLoading(false)
      if (result.success) {
        setBookingNumber(result.bookingNumber)
        if (result.requiresPayment && result.clientSecret) {
          setClientSecret(result.clientSecret)
          setDepositAmount(Number(result.depositAmount ?? 0))
          setBalanceAmount(Number(result.balanceAmount ?? 0))
        } else {
          setEmailSent(Boolean(result.emailSent))
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

  // Payment / Success screens (unchanged)
  if (bookingNumber && clientSecret && !paid) {
    return (
      <div className="card p-8 md:p-10 max-w-lg mx-auto">
        <h2 className="text-3xl tracking-tight mb-1">Secure your reservation</h2>
        <p className="text-[#a1a1aa] text-sm mb-6">
          Booking <span className="font-mono text-[#c5a26f]">{bookingNumber}</span> — a 10% deposit confirms it.
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
        {/* Your existing confirmation JSX — keep it as is */}
        <div className="text-center">
          <div className="text-6xl mb-6 text-[#c5a26f]">✓</div>
          <h2 className="text-4xl tracking-tight mb-2">Booking Confirmed!</h2>
          <p className="text-[#a1a1aa] text-sm mb-4">Your reservation is registered. Here are the details:</p>
          <p className="text-[#c5a26f] text-3xl font-mono mb-8">{bookingNumber}</p>
        </div>
        {/* ... rest of confirmation content ... */}
      </div>
    )
  }

  // Google Maps Loading States
  if (loadError) {
    return <div className="text-red-500 p-8 text-center border border-red-500/30 rounded-2xl">Failed to load Google Maps. Please refresh the page.</div>
  }

  if (!isLoaded) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-12 h-12 text-[#c5a26f] animate-spin mx-auto mb-4" />
        <p className="text-[#c5a26f]">Loading booking system and address search...</p>
      </div>
    )
  }

  // Main Wizard UI (your existing code)
  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress, steps, buttons, etc. — paste the rest of your original return JSX here */}
      {/* ... keep everything from the progress indicator down ... */}
    </div>
  )
}