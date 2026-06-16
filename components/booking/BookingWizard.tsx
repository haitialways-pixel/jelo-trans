'use client'

import { useState, useEffect } from 'react'
import { calculatePrice, createReservation } from '@/app/book/actions'
import { PaymentStep } from './PaymentStep'
import { AddressAutocomplete } from './AddressAutocomplete'
import { Clock, MapPin, Navigation, Loader2 } from 'lucide-react'

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
  const [googleLoaded, setGoogleLoaded] = useState(false)
  const [googleError, setGoogleError] = useState(false)

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

  // Stripe states
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState(0)
  const [balanceAmount, setBalanceAmount] = useState(0)
  const [paid, setPaid] = useState(false)

  // Manual Google Maps loading check
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      setGoogleLoaded(true)
    } else {
      const timer = setTimeout(() => {
        if (!window.google?.maps?.places) {
          setGoogleError(true)
        } else {
          setGoogleLoaded(true)
        }
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [])

  const updateForm = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  // ... keep all your existing functions: getMinDateTime, validateStep, nextStep, prevStep, getVehiclePriceQuote ...

  // Payment / Confirmation screens (keep your existing ones unchanged)
  if (bookingNumber && clientSecret && !paid) { ... }   // your code
  if (bookingNumber && (!clientSecret || paid)) { ... } // your code

  // Google loading states
  if (googleError) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-red-500 mb-4">Could not load Google Maps.</p>
        <p className="text-[#a1a1aa]">Please refresh the page or try again later.</p>
      </div>
    )
  }

  if (!googleLoaded) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-12 h-12 text-[#c5a26f] animate-spin mx-auto mb-4" />
        <p className="text-[#c5a26f]">Loading address search and availability...</p>
      </div>
    )
  }

  // Main form (your original UI)
  return (
    <div className="max-w-4xl mx-auto">
      {/* Paste all your existing main wizard JSX here (progress bar, steps, buttons, etc.) */}
      {/* Everything from the progress indicator down remains the same */}
    </div>
  )
}