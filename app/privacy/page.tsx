import type { Metadata } from 'next'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import {
  BRAND_EMAIL,
  BRAND_NAME,
  LEGAL_ENTITY,
} from '@/lib/site'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description: `How ${BRAND_NAME} collects and uses information from booking and contact forms. We do not sell personal data.`,
  path: '/privacy',
})

const EFFECTIVE = 'September 29, 2026'

export default function PrivacyPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <article className="pt-32 pb-24 max-w-3xl mx-auto px-5 sm:px-8 md:px-12">
        <div className="accent-line mb-10" />
        <h1 className="font-display text-5xl font-medium leading-tight">Privacy Policy</h1>
        <p className="text-on-surface-variant text-sm mt-4">
          Effective {EFFECTIVE} · {LEGAL_ENTITY}
        </p>

        <div className="mt-12 space-y-10 text-on-surface-variant leading-relaxed text-sm">
          <section>
            <h2 className="font-display text-2xl text-on-surface mb-3">Who we are</h2>
            <p>
              {LEGAL_ENTITY} (“we,” “us”) provides chauffeured ground transportation in Orlando, Florida.
              This policy describes how we handle personal information collected through vipodyssey.com,
              our booking wizard, contact form, and related emails.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-on-surface mb-3">What we collect</h2>
            <p>We collect information you give us in order to provide a ride or answer an inquiry:</p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Pickup and drop-off addresses, date and time, passenger and luggage counts</li>
              <li>Flight numbers and special requests you choose to share</li>
              <li>Payment details processed by Stripe when a deposit or fare is charged (we do not store full card numbers)</li>
              <li>Messages sent through the contact form or chatbot</li>
            </ul>
            <p className="mt-3">
              Our servers and providers may also receive technical data such as IP address, browser type, and
              pages visited, used to operate and secure the site.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-on-surface mb-3">How we use it</h2>
            <p>We use this information to:</p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Quote, confirm, dispatch, and complete reservations</li>
              <li>Process deposits and fares, and send receipts</li>
              <li>Respond to inquiries and provide concierge support</li>
              <li>Meet legal, insurance, and accounting requirements</li>
              <li>Improve reliability and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-on-surface mb-3">We do not sell data</h2>
            <p>
              We do not sell, rent, or trade your personal information. We share it only with service
              providers who help us operate (for example Stripe for payments, email delivery, mapping, and
              hosting), with chauffeurs assigned to your trip, or when the law requires it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-on-surface mb-3">Retention</h2>
            <p>
              Reservation and payment records are kept as long as needed for operations, tax, and insurance.
              You may ask us to update or delete information that we are not required to keep.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-on-surface mb-3">Contact</h2>
            <p>
              Privacy questions and requests: email{' '}
              <a href={`mailto:${BRAND_EMAIL}`} className="text-gold hover:underline">
                {BRAND_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
      <Footer />
    </div>
  )
}
