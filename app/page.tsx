import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { FeaturedFleetSection } from '@/components/home/FeaturedFleetSection'
import { FeaturedFleetSkeleton } from '@/components/home/FeaturedFleetSkeleton'
import { PlaneTakeoff, Briefcase, PartyPopper, BadgeCheck, EyeOff, Gem } from 'lucide-react'

export const runtime = 'edge'
export const revalidate = 300

const SERVICES = [
  {
    icon: PlaneTakeoff,
    title: 'Airport Transfers',
    desc: 'Seamless transportation to MCO and private terminals with flight tracking and meet-and-greet service.',
  },
  {
    icon: Briefcase,
    title: 'Corporate Travel',
    desc: 'Quiet, reliable transport for executives and business delegations across Central Florida.',
  },
  {
    icon: PartyPopper,
    title: 'Special Events',
    desc: 'Arrive with grace for weddings, galas, and exclusive occasions throughout the region.',
  },
]

const VALUES = [
  { icon: BadgeCheck, title: 'Professionalism', desc: 'Vetted, uniformed chauffeurs with expert local knowledge.' },
  { icon: EyeOff, title: 'Discretion', desc: 'Your privacy is our utmost priority throughout every journey.' },
  { icon: Gem, title: 'Refinement', desc: 'Pristine vehicles with premium amenities for ultimate comfort.' },
]

export default function Home() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-end">
        <div className="absolute inset-0">
          <Image
            src="/images/stitch-suv-studio.webp"
            alt="Imperial Odyssey luxury chauffeur service in Orlando"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center brightness-[1.03]"
          />
          <div className="absolute inset-0 hero-luxe-overlay" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-8 md:px-12 pb-24 md:pb-32 pt-40">
          <div className="accent-line mb-10" />
          <p className="text-xs tracking-[0.35em] uppercase text-on-surface-variant mb-8">
            Orlando, Florida
          </p>
          <h1 className="font-display text-5xl md:text-7xl lg:text-[5.5rem] font-medium leading-[1.05] max-w-4xl">
            The art of arriving well.
          </h1>
          <p className="text-on-surface-variant text-lg md:text-xl max-w-xl mt-10 leading-relaxed">
            White-glove chauffeur service for those who value time, comfort, and quiet excellence.
          </p>
          <div className="mt-14 flex flex-wrap gap-5">
            <Link href="/book" className="btn-cta inline-block text-sm px-10 py-4 rounded-full">
              Reserve Your Journey
            </Link>
            <Link
              href="/fleet"
              className="inline-flex items-center text-sm text-on-surface-variant hover:text-on-surface transition px-6 py-4"
            >
              Explore the fleet →
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES — cream floating cards */}
      <section className="section-pad bg-background">
        <div className="max-w-6xl mx-auto px-8 md:px-12">
          <div className="max-w-2xl mb-20">
            <p className="text-xs tracking-[0.3em] uppercase text-on-surface-variant mb-6">What we offer</p>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-tight">
              Tailored to every occasion
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {SERVICES.map((s) => (
              <article key={s.title} className="float-card p-10 md:p-12">
                <s.icon className="w-5 h-5 text-gold mb-10" strokeWidth={1.5} />
                <h3 className="font-display text-2xl mb-5">{s.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{s.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<FeaturedFleetSkeleton />}>
        <FeaturedFleetSection />
      </Suspense>

      {/* VALUES */}
      <section className="section-pad bg-surface-container-low">
        <div className="max-w-6xl mx-auto px-8 md:px-12">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <div className="accent-line mx-auto mb-8" />
            <h2 className="font-display text-4xl md:text-5xl font-medium">The Imperial Odyssey standard</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {VALUES.map((v) => (
              <article key={v.title} className="float-card p-10 text-center bg-card">
                <v.icon className="w-5 h-5 text-primary mx-auto mb-8" strokeWidth={1.5} />
                <h3 className="text-xs tracking-[0.25em] uppercase mb-4">{v.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{v.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section-pad text-center">
        <div className="max-w-2xl mx-auto px-8 md:px-12">
          <div className="accent-line mx-auto mb-10" />
          <h2 className="font-display text-4xl md:text-5xl font-medium mb-8">Ready when you are.</h2>
          <p className="text-on-surface-variant leading-relaxed mb-12">
            Reserve online in minutes, or speak with our concierge anytime — day or night.
          </p>
          <Link href="/book" className="btn-cta inline-block text-sm px-12 py-4 rounded-full">
            Begin Your Reservation
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}