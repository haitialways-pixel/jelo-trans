'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import { createManualReservation } from '@/lib/manager/actions'
import type { ManagerFleetModel } from '@/lib/manager/data'

export function CreateReservationForm({ fleet }: { fleet: ManagerFleetModel[] }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  const [form, setForm] = useState({
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
    totalPrice: '',
    distanceMiles: '',
    specialRequests: '',
    notifyCustomer: true,
  })

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function submit() {
    if (!form.customerName.trim() || !form.customerEmail.trim() || !form.customerPhone.trim()) {
      toast.error('Customer name, email, and phone are required')
      return
    }
    if (!form.pickupAddress.trim() || !form.dropoffAddress.trim() || !form.pickupTime) {
      toast.error('Pickup, drop-off, and date/time are required')
      return
    }
    const price = parseFloat(form.totalPrice)
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid total price')
      return
    }
    if (!form.vehicleId) {
      toast.error('Select a vehicle type')
      return
    }

    start(async () => {
      const res = await createManualReservation({
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        pickupAddress: form.pickupAddress.trim(),
        dropoffAddress: form.dropoffAddress.trim(),
        pickupTime: new Date(form.pickupTime).toISOString(),
        vehicleId: form.vehicleId,
        passengers: parseInt(form.passengers, 10) || 1,
        luggage: parseInt(form.luggage, 10) || 0,
        durationHours: parseFloat(form.durationHours) || 3,
        specialRequests: form.specialRequests.trim() || undefined,
        totalPrice: price,
        distanceMiles: form.distanceMiles ? parseFloat(form.distanceMiles) : undefined,
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

  return (
    <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">New manual reservation</h2>
        <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Customer name" value={form.customerName} onChange={(v) => update('customerName', v)} />
        <Field label="Email" type="email" value={form.customerEmail} onChange={(v) => update('customerEmail', v)} />
        <Field label="Phone" type="tel" value={form.customerPhone} onChange={(v) => update('customerPhone', v)} />
        <Field label="Pickup date & time" type="datetime-local" value={form.pickupTime} onChange={(v) => update('pickupTime', v)} />
        <div className="sm:col-span-2">
          <Field label="Pickup address" value={form.pickupAddress} onChange={(v) => update('pickupAddress', v)} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Drop-off address" value={form.dropoffAddress} onChange={(v) => update('dropoffAddress', v)} />
        </div>

        <div>
          <label className="block text-xs text-on-surface-variant mb-1.5">Vehicle type</label>
          <select
            value={form.vehicleId}
            onChange={(e) => update('vehicleId', e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm"
          >
            {fleet.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <Field label="Total price ($)" type="number" value={form.totalPrice} onChange={(v) => update('totalPrice', v)} />
        <Field label="Passengers" type="number" value={form.passengers} onChange={(v) => update('passengers', v)} />
        <Field label="Luggage" type="number" value={form.luggage} onChange={(v) => update('luggage', v)} />
        <Field label="Duration (hours)" type="number" value={form.durationHours} onChange={(v) => update('durationHours', v)} />
        <Field label="Distance (miles, optional)" type="number" value={form.distanceMiles} onChange={(v) => update('distanceMiles', v)} />

        <div className="sm:col-span-2">
          <label className="block text-xs text-on-surface-variant mb-1.5">Special requests</label>
          <textarea
            value={form.specialRequests}
            onChange={(e) => update('specialRequests', e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
            placeholder="Optional notes for the driver"
          />
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
        {pending ? 'Creating…' : 'Create reservation'}
      </button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-on-surface-variant mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-sm"
      />
    </div>
  )
}