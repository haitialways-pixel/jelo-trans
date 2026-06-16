import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { BookingWizard } from '@/components/booking/BookingWizard'
import { createClient } from '@/lib/supabase/server'
import Script from 'next/script'

export const runtime = 'edge'

export default async function BookPage() {
  const supabase = await createClient()
  
  const { data: vehicles } = await supabase
    .from('fleet')
    .select('id, name, capacity, base_price, price_per_mile, image_url')
    .eq('status', 'available')
    .order('base_price', { ascending: true })

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <Navbar />

      {/* Google Maps Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
      />

      <div className="pt-16 pb-12 max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="text-[#c5a26f] tracking-[4px] text-xs">ORLANDO LUXURY TRANSPORTATION</div>
          <h1 className="text-6xl tracking-[-2.5px] font-semibold mt-2">Reserve Your Journey</h1>
        </div>

        <BookingWizard vehicles={vehicles ?? []} />
      </div>

      <Footer />
    </div>
  )
}