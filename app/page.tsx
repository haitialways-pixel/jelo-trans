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
  { icon: PlaneTakeoff, title: 'Airport Transfers', desc: 'Seamless transportation to MCO and private terminals with flight tracking and meet-and-greet.' },
  { icon: Briefcase, title: 'Corporate Travel', desc: 'Reliable, quiet, and professional transport for executives and business delegations.' },
  { icon: PartyPopper, title: 'Special Events', desc: 'Arrive in style for weddings, galas, and exclusive events across Central Florida.' },
]

export default function Home() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />

      {/* HERO */}
      <section className="relative h-[88vh] min-h-[620px] w-full flex items-end justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/stitch-suv-studio.webp"
            alt="Imperial Odyssey luxury SUV chauffeur service in Orlando"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center brightness-105"
          />
          <div className="absolute inset-0 hero-luxe-overlay" />
        </div>
        <div className="relative z-10 px-6 pb-16 md:pb-24 text-center max-w-3xl">
          <span className="text-[11px] tracking-[0.35em] text-secondary-dark block mb-5 font-semibold">ORLANDO, FLORIDA</span>
          <h1 className="display text-gold-gradient text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.08] mb-6">
            Your Premium Chauffeur in Orlando
          </h1>
          <p className="text-on-surface-variant md:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Experience the pinnacle of luxury travel with Imperial Odyssey&apos;s white-glove service.
          </p>
          <Link href="/book" className="gold-shimmer inline-block font-semibold tracking-[0.15em] text-sm py-4 px-12 rounded-xl shadow-lg active:scale-[0.98] transition">
            BOOK YOUR RIDE
          </Link>
        </div>
      </section>

      <Suspense fallback={<FeaturedFleetSkeleton />}>
        <FeaturedFleetSection />
      </Suspense>

      {/* SERVICES */}
      <section className="py-14 md:py-20 bg-surface-container-low border-y border-primary/15">
        <div className="px-6 max-w-7xl mx-auto text-center mb-10">
          <span className="text-[11px] tracking-[0.25em] text-primary mb-2 block">SERVICES</span>
          <h2 className="display text-gold-gradient text-3xl md:text-4xl font-semibold">Tailored to Excellence</h2>
        </div>
        <div className="px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {SERVICES.map((s) => (
            <div key={s.title} className="glass-dark gold-hairline p-6 rounded-2xl">
              <div className="bg-secondary/25 w-12 h-12 rounded-xl flex items-center justify-center mb-5">
                <s.icon className="w-6 h-6 text-secondary-dark" />
              </div>
              <h3 className="display text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE IMPERIAL ODYSSEY DISTINCTION — bento */}
      <section className="py-14 md:py-20 px-6 max-w-5xl mx-auto">
        <h2 className="display text-gold-gradient text-3xl md:text-4xl font-semibold text-center mb-8">The Imperial Odyssey Distinction</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 glass-dark gold-hairline p-8 rounded-2xl text-center">
            <BadgeCheck className="w-10 h-10 text-gold mx-auto mb-4" />
            <h3 className="text-sm tracking-widest font-semibold mb-2">PROFESSIONALISM</h3>
            <p className="text-on-surface-variant text-xs">Vetted, uniformed chauffeurs with expert local knowledge.</p>
          </div>
          <div className="glass-dark gold-hairline p-6 rounded-2xl text-center">
            <EyeOff className="w-8 h-8 text-secondary-dark mx-auto mb-4" />
            <h3 className="text-sm tracking-widest font-semibold mb-2">DISCRETION</h3>
            <p className="text-on-surface-variant text-[11px]">Your privacy is our utmost priority throughout every journey.</p>
          </div>
          <div className="glass-dark gold-hairline p-6 rounded-2xl text-center">
            <Gem className="w-8 h-8 text-primary-dark mx-auto mb-4" />
            <h3 className="text-sm tracking-widest font-semibold mb-2">LUXURY</h3>
            <p className="text-on-surface-variant text-[11px]">Pristine interiors with premium amenities for ultimate comfort.</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 md:py-24 text-center px-6 border-t border-outline-variant/20">
        <span className="text-primary tracking-[0.25em] text-[11px] mb-3 block">YOUR JOURNEY AWAITS</span>
        <h2 className="display text-gold-gradient text-3xl md:text-5xl font-semibold mb-8">Ready when you are.</h2>
        <Link href="/book" className="gold-shimmer inline-block font-semibold tracking-[0.15em] py-4 px-14 rounded-xl">
          BEGIN YOUR RESERVATION
        </Link>
      </section>

      <Footer />
    </div>
  )
}