import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/fleet', label: 'Fleet' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'Our Story' },
  { href: '/book', label: 'Reserve' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
]

export function Footer() {
  return (
    <footer className="bg-background section-pad border-t border-outline-variant/30">
      <div className="max-w-6xl mx-auto px-8 md:px-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-16">
          <div className="max-w-sm">
            <div className="accent-line mb-8" />
            <p className="font-display text-3xl text-on-surface leading-tight">Imperial Odyssey</p>
            <p className="text-on-surface-variant mt-6 leading-relaxed">
              Orlando&apos;s premier chauffeur service — discreet, refined, and always on time.
            </p>
            <a
              href="tel:(678) 478-3506"
              className="inline-block mt-8 text-on-surface hover:text-gold transition-colors"
            >
              (678) 478-3506
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
          © {new Date().getFullYear()} Imperial Odyssey, LLC · Orlando, Florida
        </p>
      </div>
    </footer>
  )
}