import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 pt-16 pb-10 text-sm">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-y-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c5a26f] to-[#d4af37] flex items-center justify-center">
              <span className="text-[#0a0a0a] font-bold">PT</span>
            </div>
            <div className="font-semibold tracking-[3px] text-lg">PHALO TRANSPORTATION</div>
          </div>
          <p className="text-[#a1a1aa] max-w-xs">
            Orlando’s premier luxury chauffeur service for airport transfers, weddings, corporate travel, and unforgettable nights.
          </p>
          <div className="mt-6 text-[#c5a26f] font-medium">
            (678) 478-3506<br />
            Orlando, Florida
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="font-medium tracking-widest text-xs text-[#c5a26f] mb-4">EXPLORE</div>
          <div className="space-y-2 text-[#d1d5db]">
            <Link href="/fleet" className="block hover:text-white">Our Fleet</Link>
            <Link href="/services" className="block hover:text-white">Services</Link>
            <Link href="/about" className="block hover:text-white">Our Story</Link>
            <Link href="/book" className="block hover:text-white">Reserve Now</Link>
          </div>
        </div>

        <div className="md:col-span-4">
          <div className="font-medium tracking-widest text-xs text-[#c5a26f] mb-4">24/7 CONCIERGE</div>
          <p className="text-[#a1a1aa] mb-4">For immediate assistance or last-minute bookings, call or text us anytime.</p>
          <a href="tel:(678) 478-3506" className="inline-block btn-gold px-9 py-3 rounded-full text-sm tracking-[1.5px]">CALL (678) 478-3506</a>
          <div className="mt-8 text-[10px] text-[#666] tracking-widest">© {new Date().getFullYear()} PHALO TRANSPORTATION, LLC</div>
        </div>
      </div>
    </footer>
  )
}
