import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { BookingWizardLazy } from '@/components/booking/BookingWizardLazy'
import { getBookableFleetForBooking } from '@/lib/fleet'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function BookPage() {
  const vehicles = await getBookableFleetForBooking()

  return (
    <div className="bg-background min-h-screen text-on-surface">
      <Navbar />

      <div className="pt-32 pb-24 max-w-4xl mx-auto px-8 md:px-12">
        <div className="mb-16 max-w-2xl">
          <div className="accent-line mb-8" />
          <p className="text-xs tracking-[0.3em] uppercase text-on-surface-variant mb-6">
            Orlando luxury transportation
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-medium leading-tight">
            Reserve your journey
          </h1>
          <p className="text-on-surface-variant mt-6 leading-relaxed">
            Select your vehicle, choose gratuity, and secure your chauffeur in minutes.
          </p>
        </div>

        <BookingWizardLazy vehicles={vehicles} />
      </div>

      <Footer />
    </div>
  )
}