'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Phone } from 'lucide-react'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c5a26f] to-[#d4af37] flex items-center justify-center">
            <span className="text-[#0a0a0a] font-bold text-xl tracking-[-1.5px]">PT</span>
          </div>
          <div>
            <div className="font-semibold tracking-[2px] text-lg">PHALO TRANSPORTATION</div>
            <div className="text-[10px] text-[#c5a26f] -mt-1.5">ORLANDO</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-9 text-sm font-medium tracking-wider">
          <Link href="/fleet" className="hover:text-[#c5a26f] transition">FLEET</Link>
          <Link href="/services" className="hover:text-[#c5a26f] transition">SERVICES</Link>
          <Link href="/about" className="hover:text-[#c5a26f] transition">OUR STORY</Link>
          <Link href="/contact" className="hover:text-[#c5a26f] transition">CONTACT</Link>
          <Link href="/book" className="btn-gold px-8 py-2.5 rounded-full text-sm tracking-[1px]">BOOK NOW</Link>
          <Link href="/manage-booking" className="btn-outline-gold px-5 py-2.5 rounded-full text-sm tracking-[1px]">MANAGE BOOKING</Link>
        </div>

        <a href="tel:(678) 478-3506" className="hidden md:flex items-center gap-2 text-sm text-[#c5a26f] hover:text-white">
          <Phone className="w-4 h-4" /> (678) 478-3506
        </a>

        <button onClick={() => setOpen(!open)} className="md:hidden text-white">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0a0a0a] px-6 py-8 flex flex-col gap-6 text-lg">
          <Link href="/fleet" onClick={() => setOpen(false)}>Fleet</Link>
          <Link href="/services" onClick={() => setOpen(false)}>Services</Link>
          <Link href="/about" onClick={() => setOpen(false)}>Our Story</Link>
          <Link href="/contact" onClick={() => setOpen(false)}>Contact</Link>
          <Link href="/book" onClick={() => setOpen(false)} className="btn-gold text-center py-3 rounded-full">BOOK YOUR RIDE</Link>
          <Link href="/manage-booking" onClick={() => setOpen(false)} className="text-center py-3 border border-[#c5a26f] rounded-full">MANAGE BOOKING</Link>
          <a href="tel:(678) 478-3506" className="text-[#c5a26f] text-center">(678) 478-3506</a>
        </div>
      )}
    </nav>
  )
}
