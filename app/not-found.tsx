import Link from 'next/link'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'

export default function NotFound() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />
      <div className="pt-40 pb-24 max-w-xl mx-auto px-5 sm:px-8 text-center">
        <div className="accent-line mx-auto mb-10" />
        <p className="text-xs tracking-[0.3em] uppercase text-gold mb-6">404</p>
        <h1 className="font-display text-5xl font-medium">This page has left the route.</h1>
        <p className="text-on-surface-variant mt-6 leading-relaxed">
          The address may have changed. Our concierge can still get you where you need to go.
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link href="/" className="btn-cta inline-block text-sm px-8 py-4 rounded-full">
            Home
          </Link>
          <Link href="/book" className="btn-outline-gold inline-block text-sm px-8 py-4 rounded-full">
            Reserve
          </Link>
          <Link href="/contact" className="inline-flex items-center text-sm text-on-surface-variant hover:text-gold px-4 py-4">
            Contact →
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
