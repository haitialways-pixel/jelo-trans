import type { Metadata } from 'next'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { ContactForm } from './ContactForm'
import { BRAND_CONCIERGE_EMAIL, BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL } from '@/lib/site'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description: `Call or text ${BRAND_PHONE_DISPLAY} or email ${BRAND_CONCIERGE_EMAIL} for 24/7 chauffeur service in Orlando.`,
  path: '/contact',
})

export default function ContactPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-32 pb-24 max-w-3xl mx-auto px-5 sm:px-8 md:px-12">
        <div className="accent-line mb-10" />
        <h1 className="font-display text-5xl md:text-6xl font-medium leading-tight">Let&apos;s talk</h1>
        <p className="text-xl text-on-surface-variant mt-8 leading-relaxed">
          We&apos;re available 24 hours a day, 365 days a year.
        </p>

        <div className="mt-20 grid md:grid-cols-2 gap-x-16 gap-y-14">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-gold mb-3">Call or text</p>
            <a href={BRAND_PHONE_TEL} className="font-display text-4xl hover:text-gold transition">
              {BRAND_PHONE_DISPLAY}
            </a>
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-gold mb-3">Email</p>
            <a href={`mailto:${BRAND_CONCIERGE_EMAIL}`} className="text-xl hover:text-gold transition">
              {BRAND_CONCIERGE_EMAIL}
            </a>
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-gold mb-3">Location</p>
            <p className="leading-relaxed">
              Orlando, Florida
              <br />
              Serving MCO, the theme parks, the convention center, Port Canaveral, and Central Florida
            </p>
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-gold mb-3">Immediate bookings</p>
            <p className="text-on-surface-variant leading-relaxed">
              Call or text the number above — we typically respond within minutes.
            </p>
          </div>
        </div>

        <div className="mt-24 relative">
          <ContactForm />
        </div>
      </div>
      <Footer />
    </div>
  )
}
