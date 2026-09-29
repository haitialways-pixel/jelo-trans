import type { Metadata } from 'next'
import Image from 'next/image'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Our Story',
  description:
    'Imperial Odyssey was founded in 2026 in Orlando to deliver refined, reliable, discreet chauffeur service across Central Florida.',
  path: '/about',
})

export default function AboutPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 md:px-12">
          <div className="accent-line mb-10" />
          <p className="text-xs tracking-[0.3em] uppercase text-gold">Established 2026</p>
          <h1 className="font-display text-5xl md:text-6xl font-medium leading-tight mt-6">
            The Imperial Odyssey standard
          </h1>
          <p className="text-xl text-on-surface-variant mt-8 leading-relaxed max-w-3xl">
            We exist to deliver the most refined, reliable, and discreet ground transportation experience in
            Central Florida.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto px-5 sm:px-8 md:px-12 mt-20">
          <div className="relative min-h-[360px] md:min-h-[480px] rounded-2xl overflow-hidden float-card">
            <Image
              src="/images/about-chauffeur-1.webp"
              alt="Imperial Odyssey chauffeurs on the tarmac"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="relative min-h-[360px] md:min-h-[480px] rounded-2xl overflow-hidden float-card">
            <Image
              src="/images/about-chauffeur-2.webp"
              alt="Imperial Odyssey chauffeurs with the fleet"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-5 sm:px-8 md:px-12 py-24 text-on-surface-variant leading-relaxed space-y-8 text-lg">
          <p>
            Imperial Odyssey was founded in June 2026 with a simple belief: that every client deserves to feel
            like the most important person in the world the moment they step into one of our vehicles.
          </p>
          <p>
            Our chauffeurs are not just drivers — they are ambassadors. Background-checked, professionally
            trained, and genuinely passionate about white-glove service.
          </p>
          <p>
            We operate a meticulously maintained fleet of twelve full-size SUVs, a Tesla Model Y, and luxury
            sedans through partner chauffeurs, with an obsessive attention to detail that our clients notice
            immediately.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
