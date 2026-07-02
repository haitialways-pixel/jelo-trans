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

      <div className="pt-16 pb-12 max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="pearl-accent-bar w-16 mx-auto mb-4" />
          <div className="text-secondary-dark tracking-[4px] text-xs font-medium">ORLANDO LUXURY TRANSPORTATION</div>
          <h1 className="display text-gold-gradient text-5xl md:text-6xl tracking-tight font-semibold mt-2">
            Reserve Your Journey
          </h1>
          <p className="text-on-surface-variant text-sm mt-3 max-w-xl mx-auto">
            Select your vehicle, choose gratuity, and secure your chauffeur in minutes.
          </p>
        </div>

        <BookingWizardLazy vehicles={vehicles} />
      </div>

      <Footer />
    </div>
  )
}