'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import { createManualReservation } from '@/lib/manager/actions'
import type { ManagerFleetModel } from '@/lib/manager/data'

type ServiceType = 'transfer' | 'charter'

export function CreateReservationForm({ fleet }: { fleet: ManagerFleetModel[] }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  const [form, setForm] = useState({
    serviceType: 'transfer' as ServiceType,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    pickupAddress: '',
    dropoffAddress: '',
    pickupTime: '',
    vehicleId: fleet[0]?.id ?? '',
    passengers: '2',
    luggage: '0',
    durationHours: '3',
    charterHours: '3',
    hourlyRate: fleet[0]?.base_price ? String(fleet[0].base_price) : '',
    totalPrice: '',
    distanceMiles: '',
    specialRequests: '',
    notifyCustomer: true,
  })

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function setServiceType(next: ServiceType) {
    setForm((prev) => {
      const selected = fleet.find((v) => v.id === prev.vehicleId)
      // Seed hourly rate from vehicle base price when switching to charter if blank.
      const hourlyRate =
        next === 'charter' && !prev.hourlyRate.trim() && selected
          ? String(selected.base_price)
          : prev.hourlyRate
      return { ...prev, serviceType: next, hourlyRate }
    })
  }

  function onVehicleChange(vehicleId: string) {
    setForm((prev) => {
      const selected = fleet.find((v) => v.id === vehicleId)
      // Only auto-fill hourly rate in charter mode when the field is empty or still
      // matches the previous vehicle's base (so manual overrides are kept).
      const prevVehicle = fleet.find((v) => v.id === prev.vehicleId)
      const stillDefault =
        !prev.hourlyRate.trim() ||
        (prevVehicle && prev.hourlyRate === String(prevVehicle.base_price))
      const hourlyRate =
        prev.serviceType === 'charter' && stillDefault && selected
          ? String(selected.base_price)
          : prev.hourlyRate
      return { ...prev, vehicleId, hourlyRate }
    })
  }

  const charterTotal = useMemo(() => {
    const hours = parseFloat(form.charterHours)
    const rate = parseFloat(form.hourlyRate)
    if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(rate) || rate < 0) return null
    return Math.round(hours * rate * 100) / 100
  }, [form.charterHours, form.hourlyRate])

  function submit() {
    if (!form.customerName.trim() || !form.customerEmail.trim() || !form.customerPhone.trim()) {
      toast.error('Customer name, email, and phone are required')
      return
    }
    if (!form.pickupAddress.trim() || !form.pickupTime) {
      toast.error('Pickup address and date/time are required')
      return
    }

    const isCharter = form.serviceType === 'charter'
    if (!isCharter && !form.dropoffAddress.trim()) {
      toast.error('Drop-off address is required for point-to-point transfers')
      return
    }

    let price: number
    let durationHours: number
    if (isCharter) {
      const hours = parseFloat(form.charterHours)
      const rate = parseFloat(form.hourlyRate)
      if (!Number.isFinite(hours) || hours <= 0) {
        toast.error('Enter a valid number of charter hours')
        return
      }
      if (!Number.isFinite(rate) || rate < 0) {
        toast.error('Enter a valid rate per hour')
        return
      }
      durationHours = hours
      price = Math.round(hours * rate * 100) / 100
    } else {
      price = parseFloat(form.totalPrice)
      if (!Number.isFinite(price) || price < 0) {
        toast.error('Enter a valid total price')
        return
      }
      durationHours = parseFloat(form.durationHours) || 3
    }

    if (!form.vehicleId) {
      toast.error('Select a vehicle type')
      return
    }

    const dropoff = form.dropoffAddress.trim() || (isCharter ? 'As directed (hourly charter)' : '')

    let specialRequests = form.specialRequests.trim()
    if (isCharter) {
      const hours = parseFloat(form.charterHours)
      const rate = parseFloat(form.hourlyRate)
      const charterNote = `Charter: ${hours}h × $${rate.toFixed(2)}/hr = $${price.toFixed(2)}`
      specialRequests = specialRequests ? `${charterNote}\n${specialRequests}` : charterNote
    }

    start(async () => {
      const res = await createManualReservation({
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        pickupAddress: form.pickupAddress.trim(),
        dropoffAddress: dropoff,
        pickupTime: new Date(form.pickupTime).toISOString(),
        vehicleId: form.vehicleId,
        passengers: parseInt(form.passengers, 10) || 1,
        luggage: parseInt(form.luggage, 10) || 0,
        durationHours,
        specialRequests: specialRequests || undefined,
        totalPrice: price,
        distanceMiles:
          !isCharter && form.distanceMiles ? parseFloat(form.distanceMiles) : undefined,
        notifyCustomer: form.notifyCustomer,
      })

      if (res.ok) {
        toast.success(`Reservation created${res.bookingNumber ? ` · ${res.bookingNumber}` : ''}`)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/40 text-primary hover:bg-primary/10 text-sm font-medium px-4 py-2.5 transition"
      >
        <Plus className="w-4 h-4" /> Create New Reservation
      </button>
    )
  }

  const isCharter = form.serviceType === 'charter'

  return (
    <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">
          New manual reservation
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="text-on-surface-variant hover:text-on-surface"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Service type */}
      <div>
        <p className="text-xs text-on-surface-variant mb-1.5">Service type</p>
        <div className="flex flex-wrap gap-2">
          <ServiceChip
            active={!isCharter}
            label="Point-to-point"
            onClick={() => setServiceType('transfer')}
          />
          <ServiceChip
            active={isCharter}
            label="Charter (hourly)"
            onClick={() => setServiceType('charter')}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Customer name"
          value={form.customerName}
          onChange={(v) => update('customerName', v)}
        />
        <Field
          label="Email"
          type="email"
          value={form.customerEmail}
          onChange={(v) => update('customerEmail', v)}
        />
        <Field
          label="Phone"
          type="tel"
          value={form.customerPhone}
          onChange={(v) => update('customerPhone', v)}
        />
        <Field
          label="Pickup date & time"
          type="datetime-local"
          value={form.pickupTime}
          onChange={(v) => update('pickupTime', v)}
        />
        <div className="sm:col-span-2">
          <Field
            label="Pickup address"
            value={form.pickupAddress}
            onChange={(v) => update('pickupAddress', v)}
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            label={isCharter ? 'Drop-off address (optional — defaults to “As directed”)' : 'Drop-off address'}
            value={form.dropoffAddress}
            onChange={(v) => update('dropoffAddress', v)}
            placeholder={isCharter ? 'As directed (hourly charter)' : undefined}
          />
        </div>

        <div>
          <label className="block text-xs text-on-surface-variant mb-1.5">Vehicle type</label>
          <select
            value={form.vehicleId}
            onChange={(e) => onVehicleChange(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm"
          >
            {fleet.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {isCharter ? (
          <>
            <Field
              label="Number of hours"
              type="number"
              value={form.charterHours}
              onChange={(v) => update('charterHours', v)}
              min="0.25"
              step="0.25"
            />
            <Field
              label="Rate per hour ($)"
              type="number"
              value={form.hourlyRate}
              onChange={(v) => update('hourlyRate', v)}
              min="0"
              step="0.01"
            />
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 sm:col-span-2">
              <p className="text-xs text-on-surface-variant">Charter total</p>
              <p className="display text-2xl font-semibold text-primary mt-0.5">
                {charterTotal != null
                  ? charterTotal.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                    })
                  : '—'}
              </p>
              {charterTotal != null && (
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {form.charterHours}h × $
                  {Number.isFinite(parseFloat(form.hourlyRate))
                    ? parseFloat(form.hourlyRate).toFixed(2)
                    : '—'}
                  /hr
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <Field
              label="Total price ($)"
              type="number"
              value={form.totalPrice}
              onChange={(v) => update('totalPrice', v)}
            />
            <Field
              label="Duration (hours)"
              type="number"
              value={form.durationHours}
              onChange={(v) => update('durationHours', v)}
            />
            <Field
              label="Distance (miles, optional)"
              type="number"
              value={form.distanceMiles}
              onChange={(v) => update('distanceMiles', v)}
            />
          </>
        )}

        <Field
          label="Passengers"
          type="number"
          value={form.passengers}
          onChange={(v) => update('passengers', v)}
        />
        <Field
          label="Luggage"
          type="number"
          value={form.luggage}
          onChange={(v) => update('luggage', v)}
        />

        <div className="sm:col-span-2">
          <label className="block text-xs text-on-surface-variant mb-1.5">Special requests</label>
          <textarea
            value={form.specialRequests}
            onChange={(e) => update('specialRequests', e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
            placeholder="Optional notes for the driver"
          />
          {isCharter && (
            <p className="text-[11px] text-on-surface-variant mt-1">
              Charter hours × rate will be saved on the reservation notes automatically.
            </p>
          )}
        </div>

        <label className="sm:col-span-2 flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
          <input
            type="checkbox"
            checked={form.notifyCustomer}
            onChange={(e) => update('notifyCustomer', e.target.checked)}
            className="rounded"
          />
          Send &quot;booking received&quot; email to customer
        </label>
      </div>

      <button
        onClick={submit}
        disabled={pending}
        className="gold-shimmer w-full flex items-center justify-center gap-2 font-semibold tracking-wide text-sm py-3 rounded-xl disabled:opacity-60"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {pending ? 'Creating…' : isCharter ? 'Create charter reservation' : 'Create reservation'}
      </button>
    </div>
  )
}

function ServiceChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs transition border ${
        active
          ? 'bg-gold/25 text-on-surface font-medium border-gold/40'
          : 'border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  step,
  min,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  step?: string
  min?: string
}) {
  return (
    <div>
      <label className="block text-xs text-on-surface-variant mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        className="w-full rounded-lg px-3 py-2.5 text-sm"
      />
    </div>
  )
}
