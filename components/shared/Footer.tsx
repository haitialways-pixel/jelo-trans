import Link from 'next/link'
import {
  BRAND_CONCIERGE_EMAIL,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_TEL,
  LEGAL_ENTITY_SHORT,
  SAM_LINE,
} from '@/lib/site'

const FOOTER_LINKS = [
  { href: '/fleet', label: 'Fleet' },
  { href: '/services', label: 'Services' },
  { href: '/corporate', label: 'Corporate' },
  { href: '/about', label: 'Our Story' },
  { href: '/book', label: 'Reserve' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export function Footer() {
  return (
    <footer className="bg-background section-pad border-t border-outline-variant/40">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 md:px-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-16">
          <div className="max-w-sm">
            <div className="accent-line mb-8" />
            <p className="font-display text-3xl text-on-surface leading-tight">Imperial Odyssey</p>
            <p className="text-on-surface-variant mt-6 leading-relaxed">
              Orlando&apos;s premier chauffeur service — discreet, refined, and always on time.
            </p>
            <a
              href={BRAND_PHONE_TEL}
              className="inline-block mt-8 text-on-surface hover:text-gold transition-colors"
            >
              {BRAND_PHONE_DISPLAY}
            </a>
            <a
              href={`mailto:${BRAND_CONCIERGE_EMAIL}`}
              className="block mt-2 text-on-surface-variant hover:text-gold transition-colors"
            >
              {BRAND_CONCIERGE_EMAIL}
            </a>
          </div>

          <nav className="flex flex-wrap gap-x-10 gap-y-4">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="luxe-divider mt-20 mb-8" />

        <p className="text-xs text-on-surface-variant tracking-wide">
          © {new Date().getFullYear()} {LEGAL_ENTITY_SHORT} · Orlando, Florida
        </p>
        <p className="text-xs text-on-surface-variant/80 tracking-wide mt-2">{SAM_LINE}</p>
      </div>
    </footer>
  )
}
