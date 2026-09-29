import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Manage Booking',
  description: 'Look up or cancel your Imperial Odyssey reservation with your booking number and phone.',
  path: '/manage-booking',
})

export default function ManageBookingLayout({ children }: { children: React.ReactNode }) {
  return children
}
