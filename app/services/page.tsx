import type { Metadata } from 'next'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import Link from 'next/link'
import { HOURLY_SEDAN, HOURLY_SUV } from '@/lib/site'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Services',
  description:
    'Airport transfers, hourly charters, weddings, and corporate travel in Orlando. Flat rates on named MCO trips; mileage pricing on all other transfers.',
  path: '/services',
})

const services = [
  {
    title: 'MCO Airport Transfers',
    desc: 'Flight tracking, meet & greet, and transfers from Orlando International. Named destinations (theme parks, Port Canaveral, and more) use a published flat rate; every other trip uses our mileage calculator.',
    price: 'Flat rate or mileage',
  },
  {
    title: 'Theme parks & attractions',
    desc: 'Universal, Walt Disney World, SeaWorld, ICON Park, and beyond. Matched MCO trips are billed at the flat rate for your vehicle; otherwise the quote is base plus per mile.',
    price: 'Flat rate or mileage',
  },
  {
    title: 'Port Canaveral & Kennedy Space Center',
    desc: 'Cruise terminals and the Space Coast. MCO pairs use the published flat rate in either direction.',
    price: 'Flat rate or mileage',
  },
  {
    title: 'Hourly charter',
    desc: 'As-directed service for meetings, celebrations, and nights out. SUV and sedan charters are billed hourly with a 3-hour minimum — never mixed into a transfer fare.',
    price: `SUV $${HOURLY_SUV}/hr · sedan $${HOURLY_SEDAN}/hr`,
  },
  {
    title: 'Corporate & executive',
    desc: 'Convention center runs, client entertainment, and multi-stop schedules. Ask about corporate accounts and invoicing.',
    price: 'Charter or transfer',
  },
  {
    title: 'Weddings & celebrations',
    desc: 'Arrive in a full-size SUV or luxury sedan with a professional chauffeur. Hourly charter keeps the vehicle with you.',
    price: `From $${HOURLY_SEDAN}/hr (3h min)`,
  },
]

export default function ServicesPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-32 pb-24 max-w-4xl mx-auto px-5 sm:px-8 md:px-12">
        <div className="accent-line mb-10" />
        <h1 className="font-display text-5xl md:text-6xl font-medium leading-tight">Services &amp; occasions</h1>
        <p className="text-xl text-on-surface-variant mt-8 leading-relaxed max-w-2xl">
          Point-to-point transfers use our mileage calculator unless the trip is between MCO and a named
          destination — then you see the flat rate. Hourly charters are a separate choice: SUV ${HOURLY_SUV}
          /hour, sedan ${HOURLY_SEDAN}/hour, 3-hour minimum.
        </p>

        <div className="mt-20 space-y-8">
          {services.map((s) => (
            <article
              key={s.title}
              className="float-card p-10 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8"
            >
              <div className="max-w-xl">
                <h2 className="font-display text-2xl md:text-3xl">{s.title}</h2>
                <p className="text-on-surface-variant mt-4 leading-relaxed">{s.desc}</p>
              </div>
              <div className="md:text-right shrink-0">
                <p className="text-xs tracking-[0.2em] uppercase text-gold mb-2">Pricing</p>
                <p className="font-display text-xl tabular-nums">{s.price}</p>
                <Link href="/book" className="inline-block mt-6 text-sm text-on-surface-variant hover:text-gold transition">
                  Book this service →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
