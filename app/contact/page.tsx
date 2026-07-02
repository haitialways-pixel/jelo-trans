import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'

export const revalidate = 3600

export default function ContactPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-24 max-w-3xl mx-auto px-6 pb-24">
        <div className="pearl-accent-bar w-20 mb-6" />
        <h1 className="display text-gold-gradient text-7xl tracking-[-3px] font-semibold">Let's Talk</h1>
        <p className="text-2xl text-secondary-dark mt-2">We're available 24 hours a day, 365 days a year.</p>

        <div className="mt-12 grid md:grid-cols-2 gap-x-16 gap-y-10 text-lg">
          <div>
            <div className="text-gold-dark text-xs tracking-[3px] mb-2">CALL OR TEXT</div>
            <a href="tel:(678) 478-3506" className="text-5xl tracking-[-1.5px] font-semibold hover:text-gold-dark">(678) 478-3506</a>
          </div>
          <div>
            <div className="text-gold-dark text-xs tracking-[3px] mb-2">EMAIL</div>
            <a href="mailto:concierge@phalotrans.com" className="text-2xl hover:text-gold-dark">concierge@phalotrans.com</a>
          </div>
          <div>
            <div className="text-gold-dark text-xs tracking-[3px] mb-2">LOCATION</div>
            <div>Orlando, Florida<br />Serving MCO, all major ports, all of Central Florida and Beyond</div>
          </div>
          <div>
            <div className="text-gold-dark text-xs tracking-[3px] mb-2">FOR IMMEDIATE BOOKINGS</div>
            <div className="text-on-surface-variant">Call or text the number above.<br />We typically respond within minutes.</div>
          </div>
        </div>

        <div className="mt-16 pt-10 border-t border-primary/25">
          <form className="max-w-lg space-y-5">
            <input type="text" placeholder="Your name" className="w-full px-6 py-4 rounded-2xl text-lg" />
            <input type="email" placeholder="Email address" className="w-full px-6 py-4 rounded-2xl text-lg" />
            <input type="tel" placeholder="Phone number" className="w-full px-6 py-4 rounded-2xl text-lg" />
            <textarea placeholder="How can we assist you?" rows={5} className="w-full px-6 py-4 rounded-3xl text-lg resize-y" />
            <button type="button" className="btn-gold w-full py-5 rounded-full text-lg tracking-[2px]">SEND MESSAGE</button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}