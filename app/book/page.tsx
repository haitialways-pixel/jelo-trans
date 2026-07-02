import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { BookingWizardSkeleton } from '@/components/booking/BookingWizardSkeleton'
import { getBookableFleet } from '@/lib/fleet'

const BookingWizard = dynamic(
  () => import('@/components/booking/BookingWizard').then((m) => ({ default: m.BookingWizard })),
  { loading: () => <BookingWizardSkeleton />, ssr: false },
)

export const runtime = 'edge'
export const revalidate = 300

export default async function BookPage() {
  const vehicles = await getBookableFleet()

  return (
    <div className="bg-background min-h-screen text-on-surface">
      <Navbar />

      <div className="pt-16 pb-12 max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="text-primary tracking-[4px] text-xs font-medium">ORLANDO LUXURY TRANSPORTATION</div>
          <h1 className="display text-5xl md:text-6xl tracking-tight font-semibold mt-2 text-on-surface">
            Reserve Your Journey
          </h1>
          <p className="text-on-surface-variant text-sm mt-3 max-w-xl mx-auto">
            Select your vehicle, choose gratuity, and secure your chauffeur in minutes.
          </p>
        </div>

        <Suspense fallback={<BookingWizardSkeleton />}>
          <BookingWizard vehicles={vehicles} />
        </Suspense>
      </div>

      <Footer />
    </div>
  )
}