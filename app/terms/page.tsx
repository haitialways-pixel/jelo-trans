import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import {
  BRAND_EMAIL,
  BRAND_PHONE_DISPLAY,
  LEGAL_ENTITY,
  PAYMENT_POLICY,
} from '@/lib/site'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'Terms governing Imperial Odyssey chauffeur services in Orlando, Florida — bookings, payments, cancellations, and liability.',
  path: '/terms',
})

const EFFECTIVE_DATE = 'September 29, 2026'
const COMPANY = 'Imperial Odyssey'
const STATE = 'Florida'
const CITY = 'Orlando'
const PHONE = BRAND_PHONE_DISPLAY
const EMAIL = BRAND_EMAIL

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing our website or booking any service offered by ${COMPANY} ("Company," "we," "us," or "our"), you ("Customer," "you," or "your") agree to be legally bound by these Terms of Service ("Terms"). If you do not agree with any part of these Terms, you must not use our services.

These Terms constitute a legally binding agreement between you and ${LEGAL_ENTITY}. These Terms are governed by the laws of the State of ${STATE} and applicable federal laws of the United States of America.`,
  },
  {
    id: 'services',
    title: '2. Services Provided',
    content: `${COMPANY} provides luxury ground transportation services in ${CITY}, ${STATE} and the surrounding Central Florida area, including but not limited to:

• Airport transfers to and from Orlando International Airport (MCO) and private terminals
• Corporate transportation and executive travel
• Wedding, gala, and special event transportation
• Hourly charter and as-directed service
• Point-to-point luxury transfers

All services are provided by licensed, professional chauffeurs operating fully insured, inspected, and registered vehicles. We carry insurance meeting Florida requirements for for-hire passenger vehicles, and we operate in accordance with applicable Orange County ordinances.`,
  },
  {
    id: 'reservations',
    title: '3. Reservations & Booking',
    content: `3.1 — Booking Confirmation. Submitting a reservation request does not charge you and does not confirm the trip. A reservation is confirmed only when a staff member reviews the request and sends written or electronic confirmation.

3.2 — Accuracy of Information. You agree to provide accurate, current, and complete information when making a reservation. ${COMPANY} is not responsible for service failures resulting from incorrect information provided by the Customer (e.g., wrong flight number, address, or pickup time).

3.3 — Age Requirement. You must be at least 18 years of age to make a reservation. By booking, you represent and warrant that you meet this requirement.

3.4 — Reservation Changes. Changes to reservations are subject to availability and must be requested at least 24 hours before the scheduled pickup. We will make commercially reasonable efforts to accommodate changes but cannot guarantee availability.

3.5 — Delay Notification. If you anticipate being delayed and are unable to be present at the scheduled pickup location at the confirmed time, you must notify ${COMPANY} as soon as possible by calling ${PHONE} or via your booking confirmation contact. Delay notifications received before the chauffeur departs for the pickup location will be taken into consideration and, at ${COMPANY}'s sole discretion, the pickup time may be adjusted subject to schedule availability. Notifications received after the chauffeur has already arrived or is en route to the pickup location are not guaranteed to be accommodated and may be subject to applicable wait-time charges or cancellation fees as described in Section 5. Failure to provide timely notice of a delay constitutes a no-show.`,
  },
  {
    id: 'payment',
    title: '4. Payment Terms & Deposit',
    content: `4.1 — No charge at booking. ${PAYMENT_POLICY}

4.2 — Balance Due. The remaining balance is due after the completion of your ride and will be charged to the payment method on file, unless other arrangements (such as corporate invoicing) have been agreed in writing.

4.3 — Payment Security. All card payments are processed through Stripe, Inc., which is PCI-DSS Level 1 compliant. ${COMPANY} does not store or have access to your full card details. Payment processing is subject to Stripe's own Terms of Service and Privacy Policy.

4.4 — Pricing. All prices are quoted in US Dollars (USD). Point-to-point transfers are priced with our mileage calculator unless the trip is between Orlando International Airport (MCO) and a named destination on our published flat-rate table, in either direction, in which case the matching flat rate applies. Hourly charters are billed separately at the published hourly rate with a 3-hour minimum. Quoted fares do not automatically include tolls, parking, or taxes unless the confirmation says they do. Gratuity is selected at booking and paid to your chauffeur.

4.5 — Wait Time & Overtime. Waiting time beyond the complimentary grace period (15 minutes for standard trips, 30 minutes for airport arrivals) will be billed at the applicable hourly rate, prorated per 15-minute increment.`,
  },
  {
    id: 'cancellation',
    title: '5. Cancellation & Refund Policy',
    content: `5.1 — Customer-Initiated Cancellations.

• Cancellation at least 24 hours before the scheduled pickup: the 25% deposit is fully refundable.
• Cancellation within 24 hours of the scheduled pickup: the deposit is non-refundable.
• No-shows (Customer not present at the pickup location): the full fare is due.

5.2 — Company-Initiated Cancellations. In the unlikely event that ${COMPANY} cancels a confirmed reservation for reasons within our control, you will receive a full refund of all amounts paid, including the deposit. Our liability shall be limited to this refund and shall not extend to indirect or consequential damages.

5.3 — Force Majeure. ${COMPANY} is not liable for cancellations or delays caused by events beyond our reasonable control, including but not limited to severe weather, natural disasters, acts of God, government orders, or civil unrest (see Section 10).

5.4 — Refund Processing. Approved refunds will be processed within 7–10 business days to the original payment method, subject to your bank's processing time.`,
  },
  {
    id: 'conduct',
    title: '6. Passenger Conduct & Responsibilities',
    content: `6.1 — Safe Conduct. All passengers must comply with the lawful instructions of the chauffeur and observe all applicable traffic and safety laws of the State of Florida, including Chapter 316 (State Uniform Traffic Control).

6.2 — Seatbelts. All passengers are required to wear seatbelts at all times while the vehicle is in motion, as required by Florida law.

6.3 — Prohibited Conduct. The following conduct is strictly prohibited in any ${COMPANY} vehicle:

• Possession or consumption of illegal substances
• Harassment, threats, or abusive language directed at the chauffeur or other passengers
• Tampering with or damaging any vehicle equipment
• Opening vehicle doors while in motion
• Any conduct that compromises the safety of the vehicle occupants

6.4 — Soiling & Damage. You are liable for any damage to the vehicle caused by you or your guests, including but not limited to stains, vomiting, or intentional damage. A minimum cleaning fee of $250 applies for interior soiling. Structural damage will be billed at cost of repair.

6.5 — Alcohol. The consumption of alcohol is permitted for passengers of legal drinking age (21+) where allowed by Florida law, provided the vehicle is equipped for such service and the chauffeur has confirmed this is permitted. Chauffeurs are strictly prohibited from consuming alcohol.

6.6 — Passenger Limit. Occupancy of any vehicle is limited to its rated passenger capacity. Exceeding this limit is prohibited under Florida law and may result in immediate termination of service without refund.`,
  },
  {
    id: 'liability',
    title: '7. Limitation of Liability',
    content: `7.1 — General Limitation. To the fullest extent permitted by applicable law, ${COMPANY}'s total liability to you for any claim arising from these Terms or our services shall not exceed the total amount you paid for the specific trip giving rise to the claim.

7.2 — Exclusion of Consequential Damages. ${COMPANY} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, missed flights, missed events, or damage to property not resulting from our direct negligence.

7.3 — Personal Property. ${COMPANY} is not responsible for personal property left in our vehicles. Lost items will be held for 30 days if found and may be claimed by contacting us. After 30 days, unclaimed items will be donated or disposed of.

7.4 — Third-Party Services. ${COMPANY} may rely on third-party providers (e.g., Google Maps for routing, Stripe for payments). We are not liable for errors, outages, or failures of these third-party services.

7.5 — No Warranty. THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, ${COMPANY.toUpperCase()} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.`,
  },
  {
    id: 'insurance',
    title: '8. Insurance & Licensing',
    content: `${COMPANY} maintains commercial automobile liability insurance meeting Florida requirements for for-hire passenger vehicles.

All chauffeurs employed or contracted by ${COMPANY} hold valid Florida driver's licenses with appropriate endorsements and have passed criminal background checks in compliance with applicable Florida and local requirements.`,
  },
  {
    id: 'privacy',
    title: '9. Privacy & Data Protection',
    content: `9.1 — Data Collection. We collect personal information necessary to provide our services, including your name, email address, phone number, and payment details. This information is processed in accordance with our Privacy Policy.

9.2 — CCPA Notice. Although ${COMPANY} operates in Florida, we respect the privacy rights of California residents under the California Consumer Privacy Act (CCPA). California residents may request disclosure, deletion, or opt-out of the sale of their personal data by contacting us at ${EMAIL}.

9.3 — No Sale of Data. ${COMPANY} does not sell, rent, or trade your personal information to third parties for marketing purposes.

9.4 — Communications. By providing your email address or phone number, you consent to receive transactional communications related to your reservation (confirmation, reminders, receipts). You may opt out of promotional communications at any time.`,
  },
  {
    id: 'force-majeure',
    title: '10. Force Majeure',
    content: `Neither party shall be held liable for any failure or delay in performance of obligations under these Terms if such failure or delay is caused by circumstances beyond that party's reasonable control, including but not limited to: acts of God, hurricanes (including Florida-declared weather emergencies), floods, earthquakes, fires, pandemics, epidemics, government-mandated restrictions, acts of terrorism, civil unrest, or failure of third-party transportation infrastructure.

In such events, ${COMPANY} will make commercially reasonable efforts to notify you as soon as practicable and, where feasible, to reschedule your service.`,
  },
  {
    id: 'dispute',
    title: '11. Dispute Resolution & Governing Law',
    content: `11.1 — Governing Law. These Terms shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of law provisions. Federal law shall apply where applicable.

11.2 — Informal Resolution. Before initiating any formal proceeding, both parties agree to first attempt in good faith to resolve any dispute by contacting ${COMPANY} at ${EMAIL} and providing written notice of the dispute.

11.3 — Binding Arbitration. If informal resolution fails within 30 days, any dispute, claim, or controversy arising out of or relating to these Terms or our services shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules. The arbitration shall take place in Orange County, Florida. This clause does not prevent either party from seeking emergency injunctive relief from a court of competent jurisdiction.

11.4 — Class Action Waiver. You agree that any dispute resolution proceedings will be conducted only on an individual basis and not in a class, consolidated, or representative action, to the fullest extent permitted by applicable law.

11.5 — Venue. If arbitration is found unenforceable, you consent to the exclusive jurisdiction of the state and federal courts located in Orange County, Florida.`,
  },
  {
    id: 'ada',
    title: '12. Accessibility & ADA Compliance',
    content: `${COMPANY} is committed to providing accessible transportation services in compliance with the Americans with Disabilities Act of 1990 (ADA), 42 U.S.C. § 12101 et seq. We do not discriminate against individuals with disabilities in the provision of our services.

Customers requiring accessibility accommodations (e.g., wheelchair-accessible vehicles, service animal accommodation) are encouraged to contact us at least 48 hours in advance so that we may make appropriate arrangements. We will make commercially reasonable efforts to accommodate all accessibility requests.`,
  },
  {
    id: 'modification',
    title: '13. Modifications to Terms',
    content: `${COMPANY} reserves the right to modify these Terms at any time. When we make changes, we will update the "Effective Date" at the top of this page. Continued use of our services after such changes constitutes your acceptance of the revised Terms.

For material changes, we will make reasonable efforts to notify registered customers via email at least 14 days prior to the change taking effect.`,
  },
  {
    id: 'severability',
    title: '14. Severability & Entire Agreement',
    content: `If any provision of these Terms is found by a court or arbitrator of competent jurisdiction to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect.

These Terms, together with any reservation confirmation and our Privacy Policy, constitute the entire agreement between you and ${COMPANY} with respect to the subject matter hereof and supersede all prior or contemporaneous communications and proposals, whether oral or written.`,
  },
  {
    id: 'contact',
    title: '15. Contact Information',
    content: `For questions, concerns, or complaints regarding these Terms or our services, please contact us:

${LEGAL_ENTITY}
${CITY}, ${STATE}
Phone: ${PHONE}
Email: ${EMAIL}

For legal notices, send written notice by email to ${EMAIL}.`,
  },
]

export default function TermsPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />

      <section className="pt-28 pb-12 px-6 text-center border-b border-outline-variant/20">
        <span className="text-[11px] tracking-[0.3em] text-gold block mb-4">LEGAL</span>
        <h1 className="display text-4xl md:text-5xl font-semibold mb-4">Terms of Service</h1>
        <p className="text-on-surface-variant max-w-xl mx-auto text-sm">
          Please read these Terms carefully before using our services. By making a reservation, you agree to
          be bound by these Terms.
        </p>
        <p className="text-on-surface-variant/80 text-xs mt-4">
          Effective Date: {EFFECTIVE_DATE} · Governed by Florida & U.S. Federal Law
        </p>
      </section>

      <section className="py-10 px-6 max-w-4xl mx-auto">
        <div className="glass-dark gold-hairline rounded-2xl p-6">
          <h2 className="text-xs tracking-[0.25em] text-gold font-semibold mb-4">TABLE OF CONTENTS</h2>
          <div className="grid sm:grid-cols-2 gap-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-sm text-on-surface-variant hover:text-primary transition py-1"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <article className="px-6 max-w-4xl mx-auto pb-24 space-y-12">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="display text-xl font-semibold text-on-surface mb-4 pb-3 border-b border-outline-variant/20">
              {s.title}
            </h2>
            <div className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-line">{s.content}</div>
          </section>
        ))}

        <div className="grid sm:grid-cols-3 gap-4 pt-8 border-t border-outline-variant/20">
          {[
            { law: 'Florida for-hire insurance', desc: 'Coverage meeting state requirements for passenger vehicles' },
            { law: 'ADA — 42 U.S.C. § 12101', desc: 'Accessibility & non-discrimination' },
            { law: 'Chapter 316, Florida Statutes', desc: 'State uniform traffic control' },
          ].map((b) => (
            <div key={b.law} className="glass-dark gold-hairline rounded-xl p-4 text-center">
              <div className="text-gold text-[10px] tracking-widest font-semibold mb-1">{b.law}</div>
              <div className="text-on-surface-variant text-xs">{b.desc}</div>
            </div>
          ))}
        </div>

        <p className="text-on-surface-variant/70 text-xs text-center pt-4">
          © {new Date().getFullYear()} {LEGAL_ENTITY} · All rights reserved ·{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/contact" className="text-primary hover:underline">
            Contact us
          </Link>
        </p>
      </article>

      <Footer />
    </div>
  )
}
