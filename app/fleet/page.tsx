import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { getFleet } from '@/lib/fleet'
import { VehicleCard } from '@/components/fleet/VehicleCard'
import { FeaturedFleetSkeleton } from '@/components/home/FeaturedFleetSkeleton'
import { groupPublicFleet, withPublicCatalog } from '@/lib/catalog'
import { FLEET_SUMMARY, HOURLY_SEDAN, HOURLY_SUV } from '@/lib/site'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 300

export const metadata: Metadata = pageMetadata({
  title: 'Fleet',
  description:
    'Twelve full-size SUVs, a Tesla Model Y, and luxury sedans for chauffeur service in Orlando. Chevrolet Suburban, GMC Yukon XL, Ford Expedition MAX.',
  path: '/fleet',
})

async function FleetContent() {
  const fleet = withPublicCatalog(await getFleet())
  const grouped = groupPublicFleet(fleet)

  return (
    <>
      {grouped.map((g) => (
        <section key={g.cls} className="mb-20">
          <h2 className="font-display text-3xl mb-3">{g.label}</h2>
          {g.cls === 'sedan' && (
            <p className="text-sm text-on-surface-variant mb-8 max-w-2xl">
              ${HOURLY_SEDAN}/hour with a 3-hour minimum. Provided through contracted chauffeur partners.
            </p>
          )}
          {g.cls === 'suv' && (
            <p className="text-sm text-on-surface-variant mb-8 max-w-2xl">
              ${HOURLY_SUV}/hour with a 3-hour minimum.
            </p>
          )}
          {g.cls === 'tesla' && <div className="mb-8" />}
          <div className="grid lg:grid-cols-1 gap-10">
            {g.items.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

export default function FleetPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen overflow-x-hidden">
      <Navbar />

      <div className="pt-32 pb-24 max-w-5xl mx-auto px-5 sm:px-8 md:px-12">
        <div className="accent-line mb-10" />
        <p className="text-xs tracking-[0.3em] uppercase text-gold mb-6">The collection</p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-medium leading-tight max-w-3xl break-words">
          Uncompromising <span className="italic">luxury</span>
        </h1>
        <p className="text-on-surface-variant mt-8 max-w-2xl leading-relaxed">{FLEET_SUMMARY}</p>

        <div className="mt-20">
          <Suspense fallback={<FeaturedFleetSkeleton />}>
            <FleetContent />
          </Suspense>
        </div>
      </div>

      <Footer />
    </div>
  )
}
