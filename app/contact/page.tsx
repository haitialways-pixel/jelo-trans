import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'

export const revalidate = 3600

export default function ContactPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-32 pb-24 max-w-3xl mx-auto px-8 md:px-12">
        <div className="accent-line mb-10" />
        <h1 className="font-display text-5xl md:text-6xl font-medium leading-tight">Let's talk</h1>
        <p className="text-xl text-on-surface-variant mt-8 leading-relaxed">
          We're available 24 hours a day, 365 days a year.
        </p>

        <div className="mt-20 grid md:grid-cols-2 gap-x-16 gap-y-14">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-on-surface-variant mb-3">Call or text</p>
            <a href="tel:(678) 478-3506" className="font-display text-4xl hover:text-gold transition">
              (678) 478-3506
            </a>
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-on-surface-variant mb-3">Email</p>
            <a href="mailto:concierge@phalotrans.com" className="text-xl hover:text-gold transition">
              concierge@phalotrans.com
            </a>
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-on-surface-variant mb-3">Location</p>
            <p className="leading-relaxed">
              Orlando, Florida
              <br />
              Serving MCO, all major ports, and Central Florida
            </p>
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-on-surface-variant mb-3">Immediate bookings</p>
            <p className="text-on-surface-variant leading-relaxed">
              Call or text the number above — we typically respond within minutes.
            </p>
          </div>
        </div>

        <div className="mt-24 float-card p-10 md:p-12">
          <form className="space-y-6 max-w-lg">
            <input type="text" placeholder="Your name" className="w-full px-5 py-4 text-base" />
            <input type="email" placeholder="Email address" className="w-full px-5 py-4 text-base" />
            <input type="tel" placeholder="Phone number" className="w-full px-5 py-4 text-base" />
            <textarea placeholder="How can we assist you?" rows={5} className="w-full px-5 py-4 text-base resize-y" />
            <button type="button" className="btn-cta w-full py-4 rounded-full text-sm tracking-widest">
              Send message
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}