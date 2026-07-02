import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import Link from 'next/link'

export const revalidate = 3600

const services = [
  { title: 'MCO Airport Transfers', desc: 'Flight tracking, meet & greet, and seamless transfers from Orlando International Airport.', price: 'from $95 + mileage' },
  { title: 'Private Aviation', desc: 'Discreet service at Orlando Executive Airport and other private terminals.', price: 'from $115 + mileage' },
  { title: 'Weddings & Celebrations', desc: 'Premium SUVs and Sprinters with champagne service for your special day.', price: 'from $185 + mileage' },
  { title: 'Corporate & Executive', desc: 'Full-day charters, client entertainment, and reliable multi-stop schedules.', price: 'from $145 + mileage' },
  { title: 'Prom & Special Events', desc: 'Safe, glamorous transportation for the most memorable nights.', price: 'from $145 + mileage' },
  { title: 'Nights Out', desc: 'Downtown Orlando, concerts, and nightlife. Return when you are ready.', price: 'from $125 + mileage' },
]

export default function ServicesPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-32 pb-24 max-w-4xl mx-auto px-8 md:px-12">
        <div className="accent-line mb-10" />
        <h1 className="font-display text-5xl md:text-6xl font-medium leading-tight">Services &amp; occasions</h1>
        <p className="text-xl text-on-surface-variant mt-8 leading-relaxed max-w-2xl">
          Whatever the reason for your journey, we will make it exceptional.
        </p>

        <div className="mt-20 space-y-8">
          {services.map((s) => (
            <article key={s.title} className="float-card p-10 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl md:text-3xl">{s.title}</h2>
                <p className="text-on-surface-variant mt-4 leading-relaxed">{s.desc}</p>
              </div>
              <div className="md:text-right shrink-0">
                <p className="text-xs tracking-[0.2em] uppercase text-on-surface-variant mb-2">Starting at</p>
                <p className="font-display text-2xl tabular-nums">{s.price}</p>
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