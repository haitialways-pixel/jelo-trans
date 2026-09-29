import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import {
  BRAND_CONCIERGE_EMAIL,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_TEL,
  FLEET_SUMMARY,
  SAM_CAGE,
  SAM_NAICS,
  SAM_NAICS_LABEL,
  SAM_UEI,
} from '@/lib/site'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Corporate & Government',
  description:
    'SAM.gov registered chauffeur service in Orlando. UEI XDCDBABZYA84, CAGE 24RN4, NAICS 485320. Corporate accounts, invoicing, and convention transportation.',
  path: '/corporate',
})

const POINTS = [
  {
    title: 'Government ready',
    body: `SAM.gov registered. UEI ${SAM_UEI}. CAGE ${SAM_CAGE}. NAICS ${SAM_NAICS} (${SAM_NAICS_LABEL}).`,
  },
  {
    title: 'Insured',
    body: 'Fully insured for for-hire passenger service. A certificate of insurance is available on request.',
  },
  {
    title: 'Corporate accounts',
    body: 'Invoicing, recurring schedules, and a dedicated concierge for your travel team.',
  },
  {
    title: 'Events & conventions',
    body: 'Orange County Convention Center, hotels, and multi-vehicle movements for conferences and VIP groups.',
  },
  {
    title: 'Airport meet-and-greet',
    body: 'MCO arrivals with flight tracking, a name sign, and luggage assistance.',
  },
  {
    title: 'The fleet',
    body: FLEET_SUMMARY,
  },
]

export default function CorporatePage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-32 pb-24 max-w-5xl mx-auto px-5 sm:px-8 md:px-12">
        <div className="accent-line mb-10" />
        <p className="text-xs tracking-[0.3em] uppercase text-gold mb-6">Accounts &amp; agencies</p>
        <h1 className="font-display text-5xl md:text-6xl font-medium leading-tight max-w-3xl">
          Corporate &amp; Government
        </h1>
        <p className="text-xl text-on-surface-variant mt-8 leading-relaxed max-w-2xl">
          Discreet ground transportation for executives, visiting delegations, and government travelers in
          Central Florida.
        </p>

        <div className="mt-16 grid sm:grid-cols-3 gap-4">
          {[
            { k: 'UEI', v: SAM_UEI },
            { k: 'CAGE', v: SAM_CAGE },
            { k: 'NAICS', v: `${SAM_NAICS}` },
          ].map((item) => (
            <div key={item.k} className="float-card p-6 text-center">
              <div className="text-[10px] tracking-[0.25em] uppercase text-gold">{item.k}</div>
              <div className="font-mono text-sm mt-2">{item.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-16 grid md:grid-cols-2 gap-8">
          {POINTS.map((p) => (
            <article key={p.title} className="float-card p-8">
              <h2 className="font-display text-2xl mb-4">{p.title}</h2>
              <p className="text-on-surface-variant leading-relaxed">{p.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-20 float-card p-10 md:p-12 text-center">
          <h2 className="font-display text-3xl mb-4">Set up an account</h2>
          <p className="text-on-surface-variant max-w-xl mx-auto">
            Call or email concierge for a certificate of insurance, a rate sheet, or a corporate billing
            setup.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href={BRAND_PHONE_TEL} className="btn-cta inline-block text-sm px-8 py-4 rounded-full">
              {BRAND_PHONE_DISPLAY}
            </a>
            <a
              href={`mailto:${BRAND_CONCIERGE_EMAIL}`}
              className="btn-outline-gold inline-block text-sm px-8 py-4 rounded-full"
            >
              {BRAND_CONCIERGE_EMAIL}
            </a>
            <Link href="/contact" className="inline-flex items-center text-sm text-on-surface-variant hover:text-gold px-4 py-4">
              Contact form →
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
