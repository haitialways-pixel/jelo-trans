import Link from 'next/link'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { getFeaturedFleet } from '@/lib/fleet'
import { PlaneTakeoff, Briefcase, PartyPopper, BadgeCheck, EyeOff, Gem, ChevronRight } from 'lucide-react'

const SERVICES = [
  { icon: PlaneTakeoff, title: 'Airport Transfers', desc: 'Seamless transportation to MCO and private terminals with flight tracking and meet-and-greet.' },
  { icon: Briefcase, title: 'Corporate Travel', desc: 'Reliable, quiet, and professional transport for executives and business delegations.' },
  { icon: PartyPopper, title: 'Special Events', desc: 'Arrive in style for weddings, galas, and exclusive events across Central Florida.' },
]

export const runtime = 'edge'

export default async function Home() {
  const featured = await getFeaturedFleet(6)

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />

      {/* HERO */}
      <section className="relative h-[88vh] min-h-[620px] w-full flex items-end justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/stitch-hero-night.jpg" alt="Phalo Transportation luxury SUV chauffeur service in Orlando" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/40" />
        </div>
        <div className="relative z-10 px-6 pb-16 md:pb-24 text-center max-w-2xl">
          <span className="text-[11px] tracking-[0.3em] text-primary block mb-4">ORLANDO, FLORIDA</span>
          <h1 className="display text-4xl md:text-6xl font-semibold leading-[1.05] mb-5">Your Premium Chauffeur in Orlando</h1>
          <p className="text-on-surface-variant md:text-lg mb-8 opacity-90">
            Experience the pinnacle of luxury travel with Phalo Transportation&apos;s white-glove service.
          </p>
          <Link href="/book" className="gold-shimmer inline-block font-semibold tracking-[0.15em] text-sm py-4 px-12 rounded-xl shadow-lg active:scale-[0.98] transition">
            BOOK YOUR RIDE
          </Link>
        </div>
      </section>

      {/* FEATURED FLEET — horizontal scroll, from the DB */}
      <section className="py-14 md:py-20">
        <div className="px-6 max-w-7xl mx-auto mb-6 flex justify-between items-end">
          <div>
            <span className="text-[11px] tracking-[0.25em] text-primary mb-2 block">COLLECTION</span>
            <h2 className="display text-3xl md:text-4xl font-semibold">Our Elite Fleet</h2>
          </div>
          <Link href="/fleet" className="text-primary text-[11px] tracking-widest border-b border-primary/30 pb-1 hover:text-on-surface transition shrink-0">
            VIEW ALL
          </Link>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory gap-4 px-6 pb-4 max-w-7xl mx-auto">
          {featured.map((v) => (
            <Link
              key={v.id}
              href="/book"
              className="snap-center shrink-0 w-[80%] sm:w-[360px] glass-dark gold-hairline rounded-2xl overflow-hidden p-4 group"
            >
              <div className="relative aspect-[16/10] mb-4 rounded-xl overflow-hidden bg-surface-container-lowest spotlight-glow flex items-center justify-center p-3">
                <img
                  src={v.image_url ?? '/images/fleet-overview.jpg'}
                  alt={v.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition duration-700"
                />
                <div className="absolute top-3 right-3 bg-on-surface/80 text-background text-[10px] tracking-widest px-3 py-1 rounded-full uppercase">
                  {v.tier ?? 'fleet'}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm tracking-widest text-on-surface font-semibold">{v.name}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Up to {v.capacity} passengers · from ${Math.round(Number(v.base_price))} base
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-primary shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-14 md:py-20 bg-surface-container-lowest">
        <div className="px-6 max-w-7xl mx-auto text-center mb-10">
          <span className="text-[11px] tracking-[0.25em] text-primary mb-2 block">SERVICES</span>
          <h2 className="display text-3xl md:text-4xl font-semibold">Tailored to Excellence</h2>
        </div>
        <div className="px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {SERVICES.map((s) => (
            <div key={s.title} className="glass-dark gold-hairline p-6 rounded-2xl">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-5">
                <s.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="display text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE PHALO TRANSPORTATION DISTINCTION — bento */}
      <section className="py-14 md:py-20 px-6 max-w-5xl mx-auto">
        <h2 className="display text-3xl md:text-4xl font-semibold text-center mb-8">The Phalo Transportation Distinction</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 glass-dark gold-hairline p-8 rounded-2xl text-center">
            <BadgeCheck className="w-10 h-10 text-primary mx-auto mb-4" />
            <h3 className="text-sm tracking-widest font-semibold mb-2">PROFESSIONALISM</h3>
            <p className="text-on-surface-variant text-xs">Vetted, uniformed chauffeurs with expert local knowledge.</p>
          </div>
          <div className="glass-dark gold-hairline p-6 rounded-2xl text-center">
            <EyeOff className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="text-sm tracking-widest font-semibold mb-2">DISCRETION</h3>
            <p className="text-on-surface-variant text-[11px]">Your privacy is our utmost priority throughout every journey.</p>
          </div>
          <div className="glass-dark gold-hairline p-6 rounded-2xl text-center">
            <Gem className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="text-sm tracking-widest font-semibold mb-2">LUXURY</h3>
            <p className="text-on-surface-variant text-[11px]">Pristine interiors with premium amenities for ultimate comfort.</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 md:py-24 text-center px-6 border-t border-outline-variant/20">
        <span className="text-primary tracking-[0.25em] text-[11px] mb-3 block">YOUR JOURNEY AWAITS</span>
        <h2 className="display text-3xl md:text-5xl font-semibold mb-8">Ready when you are.</h2>
        <Link href="/book" className="gold-shimmer inline-block font-semibold tracking-[0.15em] py-4 px-14 rounded-xl">
          BEGIN YOUR RESERVATION
        </Link>
      </section>

      <Footer />
    </div>
  )
}
