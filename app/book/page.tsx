import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { BookingWizard } from '@/components/booking/BookingWizard'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export default async function BookPage() {
  const supabase = await createClient()
  
  const { data: vehicles } = await supabase
    .from('fleet')
    .select('id, name, capacity, base_price, price_per_mile, image_url')
    .eq('status', 'available')
    .order('base_price', { ascending: true })

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

        <BookingWizard vehicles={vehicles ?? []} />
      </div>

      <Footer />
    </div>
  )
}