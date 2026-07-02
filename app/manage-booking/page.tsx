'use client'

import { useState } from 'react'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { getBooking, cancelBooking } from './actions'

export default function ManageBookingPage() {
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const bookingNumber = formData.get('booking_number') as string
    const phone = formData.get('phone') as string

    setLoading(true)
    setError('')
    const result = await getBooking(bookingNumber, phone)
    setLoading(false)

    if (result.success) {
      setBooking(result.data)
    } else {
      setError(result.error || 'Booking not found')
    }
  }

  const handleCancel = async () => {
    if (!booking) return
    if (!confirm('Are you sure you want to cancel this booking?')) return

    setLoading(true)
    const result = await cancelBooking(booking.booking_number, booking.customer_phone)
    setLoading(false)

    if (result.success) {
      setBooking({ ...booking, status: 'cancelled' })
    } else {
      setError(result.error || 'Failed to cancel')
    }
  }

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="max-w-lg mx-auto pt-24 px-6 pb-20">
        <h1 className="text-6xl tracking-[-2px] font-semibold">Manage Booking</h1>
        <p className="text-on-surface-variant mt-2">Enter your booking number and phone to view or cancel.</p>

        {!booking ? (
          <form onSubmit={handleSearch} className="mt-10 space-y-4">
            <input name="booking_number" placeholder="PH2K9M4X7" className="w-full px-7 py-4 rounded-2xl text-lg tracking-widest uppercase" required maxLength={8} />
            <input name="phone" placeholder="Phone number" className="w-full px-7 py-4 rounded-2xl text-lg" required />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-gold w-full py-5 rounded-full text-sm tracking-[2px] mt-2">
              {loading ? 'Searching...' : 'Find My Booking'}
            </button>
          </form>
        ) : (
          <div className="mt-10 card p-9">
            <div className="text-primary text-xs tracking-widest">BOOKING #{booking.booking_number}</div>
            <div className="text-3xl font-semibold tracking-tight mt-2">{booking.customer_name}</div>

            <div className="mt-6 space-y-2 text-sm">
              <div>Status: <span className={`badge badge-${booking.status}`}>{booking.status}</span></div>
              <div>Pickup: {new Date(booking.pickup_time).toLocaleString()}</div>
              <div>Total: ${booking.total_price}</div>
            </div>

            {booking.status !== 'cancelled' && booking.status !== 'completed' && (
              <button onClick={handleCancel} disabled={loading} className="mt-8 w-full border border-red-300 hover:bg-red-50 text-red-700 py-4 rounded-full text-sm tracking-widest">
                {loading ? 'Cancelling...' : 'Cancel This Booking'}
              </button>
            )}

            <button onClick={() => { setBooking(null); setError('') }} className="mt-4 text-xs text-[#666] underline w-full">
              Look up another booking
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
