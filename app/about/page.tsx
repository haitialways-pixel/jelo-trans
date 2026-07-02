import Image from 'next/image'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'

export const revalidate = 3600

export default function AboutPage() {
  return (
    <div className="bg-background text-on-surface">
      <Navbar />
      <div className="pt-20">
        <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
          <div className="text-secondary-dark text-xs tracking-[4px]">ESTABLISHED 2017</div>
          <h1 className="display text-gold-gradient text-7xl tracking-[-3.2px] font-semibold mt-2">The Imperial Odyssey Standard</h1>
          <p className="text-2xl text-on-surface-variant mt-6 max-w-3xl">We exist for one reason: to deliver the most refined, reliable, and discreet ground transportation experience in Central Florida.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-outline-variant/30">
          <div className="relative min-h-[320px] md:min-h-[480px]">
            <Image
              src="/images/about-chauffeur-1.webp"
              alt="Imperial Odyssey Chauffeur"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="relative min-h-[320px] md:min-h-[480px]">
            <Image
              src="/images/about-chauffeur-2.webp"
              alt="Imperial Odyssey Chauffeurs"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-20 text-lg text-on-surface-variant leading-relaxed space-y-8">
          <p>Imperial Odyssey was founded with a simple belief: that every client deserves to feel like the most important person in the world the moment they step into one of our vehicles.</p>
          <p>Our chauffeurs are not just drivers — they are ambassadors. Background-checked, professionally trained, and genuinely passionate about white-glove service.</p>
          <p>We operate a meticulously maintained fleet with an obsessive attention to detail that our clients notice immediately.</p>
        </div>
      </div>
      <Footer />
    </div>
  )
}