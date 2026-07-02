'use client'

import dynamic from 'next/dynamic'
import { BookingWizardSkeleton } from './BookingWizardSkeleton'
import type { BookableVehicle } from '@/lib/fleet'

const BookingWizard = dynamic(
  () => import('./BookingWizard').then((m) => ({ default: m.BookingWizard })),
  { loading: () => <BookingWizardSkeleton />, ssr: false },
)

export function BookingWizardLazy({ vehicles }: { vehicles: BookableVehicle[] }) {
  return <BookingWizard vehicles={vehicles} />
}