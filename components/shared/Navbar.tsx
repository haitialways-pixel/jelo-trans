'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Phone } from 'lucide-react'
import { LogoMark } from './LogoMark'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-primary/20 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark size="nav" />
          <div>
            <div className="font-semibold tracking-[2px] text-[1.35rem] leading-tight text-gold-gradient">IMPERIAL ODYSSEY</div>
            <div className="text-[10px] text-primary -mt-0.5 tracking-[0.25em]">ORLANDO</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-9 text-sm font-medium tracking-wider text-on-surface-variant">
          <Link href="/fleet" className="hover:text-primary transition">FLEET</Link>
          <Link href="/services" className="hover:text-primary transition">SERVICES</Link>
          <Link href="/about" className="hover:text-primary transition">OUR STORY</Link>
          <Link href="/contact" className="hover:text-primary transition">CONTACT</Link>
          <Link href="/book" className="btn-gold px-8 py-2.5 rounded-full text-sm tracking-[1px]">BOOK NOW</Link>
          <Link href="/manage-booking" className="btn-outline-gold px-5 py-2.5 rounded-full text-sm tracking-[1px]">MANAGE BOOKING</Link>
        </div>

        <a href="tel:(678) 478-3506" className="hidden md:flex items-center gap-2 text-sm text-primary hover:text-on-surface transition">
          <Phone className="w-4 h-4" /> (678) 478-3506
        </a>

        <button onClick={() => setOpen(!open)} className="md:hidden text-on-surface" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-outline-variant/30 bg-background px-6 py-8 flex flex-col gap-6 text-lg text-on-surface">
          <Link href="/fleet" onClick={() => setOpen(false)}>Fleet</Link>
          <Link href="/services" onClick={() => setOpen(false)}>Services</Link>
          <Link href="/about" onClick={() => setOpen(false)}>Our Story</Link>
          <Link href="/contact" onClick={() => setOpen(false)}>Contact</Link>
          <Link href="/book" onClick={() => setOpen(false)} className="btn-gold text-center py-3 rounded-full">BOOK YOUR RIDE</Link>
          <Link href="/manage-booking" onClick={() => setOpen(false)} className="btn-outline-gold text-center py-3 rounded-full">MANAGE BOOKING</Link>
          <a href="tel:(678) 478-3506" className="text-primary text-center">(678) 478-3506</a>
        </div>
      )}
    </nav>
  )
}