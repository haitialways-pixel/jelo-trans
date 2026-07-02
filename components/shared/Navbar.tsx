'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { LogoMark } from './LogoMark'

const NAV_LINKS = [
  { href: '/fleet', label: 'Fleet' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'Our Story' },
  { href: '/contact', label: 'Contact' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md">
      <nav className="max-w-6xl mx-auto px-8 md:px-12 h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-4 group">
          <LogoMark size="nav" />
          <div>
            <div className="font-display text-xl tracking-wide text-on-surface">Imperial Odyssey</div>
            <div className="text-[10px] text-on-surface-variant tracking-[0.3em] uppercase mt-0.5">Orlando</div>
          </div>
        </Link>

        <div className="hidden lg:flex items-center gap-12">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors tracking-wide"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/manage-booking"
            className="text-sm text-on-surface-variant hover:text-on-surface transition tracking-wide"
          >
            Manage Booking
          </Link>
          <Link href="/book" className="btn-cta text-sm px-8 py-3 rounded-full">
            Reserve
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-on-surface p-2"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-outline-variant/40 bg-background px-8 py-10 flex flex-col gap-8">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="font-display text-2xl text-on-surface"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/book" onClick={() => setOpen(false)} className="btn-cta text-center py-4 rounded-full">
            Reserve Your Journey
          </Link>
          <Link
            href="/manage-booking"
            onClick={() => setOpen(false)}
            className="text-center text-on-surface-variant text-sm"
          >
            Manage Booking
          </Link>
        </div>
      )}
    </header>
  )
}