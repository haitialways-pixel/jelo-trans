import Link from 'next/link'
import { LogoMark } from './LogoMark'

export function Footer() {
  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant/30 pt-16 pb-10 text-sm text-on-surface-variant">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-y-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3 mb-4">
            <LogoMark size="footer" />
            <div className="font-semibold tracking-[3px] text-[1.35rem] text-on-surface">PHALO TRANSPORTATION</div>
          </div>
          <p className="text-on-surface-variant max-w-xs">
            Orlando’s premier luxury chauffeur service for airport transfers, weddings, corporate travel, and unforgettable nights.
          </p>
          <div className="mt-6 text-primary font-medium">
            (678) 478-3506<br />
            Orlando, Florida
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="font-medium tracking-widest text-xs text-primary mb-4">EXPLORE</div>
          <div className="space-y-2">
            <Link href="/fleet" className="block hover:text-on-surface transition">Our Fleet</Link>
            <Link href="/services" className="block hover:text-on-surface transition">Services</Link>
            <Link href="/about" className="block hover:text-on-surface transition">Our Story</Link>
            <Link href="/book" className="block hover:text-on-surface transition">Reserve Now</Link>
          </div>
          <div className="font-medium tracking-widest text-xs text-primary mt-8 mb-4">LEGAL</div>
          <div className="space-y-2">
            <Link href="/terms" className="block hover:text-on-surface transition">Terms of Service</Link>
            <Link href="/contact" className="block hover:text-on-surface transition">Contact Us</Link>
          </div>
        </div>

        <div className="md:col-span-4">
          <div className="font-medium tracking-widest text-xs text-primary mb-4">24/7 CONCIERGE</div>
          <p className="text-on-surface-variant mb-4">For immediate assistance or last-minute bookings, call or text us anytime.</p>
          <a href="tel:(678) 478-3506" className="inline-block btn-gold px-9 py-3 rounded-full text-sm tracking-[1.5px]">CALL (678) 478-3506</a>
          <div className="mt-8 text-[10px] text-on-surface-variant/70 tracking-widest space-y-1">
            <div>© {new Date().getFullYear()} PHALO TRANSPORTATION, LLC</div>
            <div>
              <Link href="/terms" className="hover:text-primary transition">Terms of Service</Link>
              {' · '}
              <Link href="/contact" className="hover:text-primary transition">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}