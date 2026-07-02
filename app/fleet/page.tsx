import { Suspense } from 'react'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { getFleet } from '@/lib/fleet'
import { VehicleCard } from '@/components/fleet/VehicleCard'
import { FeaturedFleetSkeleton } from '@/components/home/FeaturedFleetSkeleton'

const TIER_ORDER = ['executive', 'premium'] as const
const TIER_LABELS: Record<string, string> = {
  executive: 'Executive SUV',
  premium: 'Premium SUV',
}

export const runtime = 'edge'
export const revalidate = 300

async function FleetContent() {
  const fleet = await getFleet()

  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABELS[tier],
    items: fleet.filter((v) => v.tier === tier),
  })).filter((g) => g.items.length > 0)

  const untiered = fleet.filter(
    (v) => !v.tier || !TIER_ORDER.includes(v.tier as (typeof TIER_ORDER)[number]),
  )

  return (
    <>
      {grouped.map((g) => (
        <section key={g.tier} className="mb-20">
          <h2 className="font-display text-3xl mb-10">{g.label}</h2>
          <div className="grid lg:grid-cols-1 gap-10">
            {g.items.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        </section>
      ))}

      {untiered.length > 0 && (
        <section className="mb-20">
          <div className="grid lg:grid-cols-1 gap-10">
            {untiered.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export default function FleetPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />

      <div className="pt-32 pb-24 max-w-5xl mx-auto px-8 md:px-12">
        <div className="accent-line mb-10" />
        <p className="text-xs tracking-[0.3em] uppercase text-on-surface-variant mb-6">The collection</p>
        <h1 className="font-display text-5xl md:text-6xl font-medium leading-tight max-w-3xl">
          Uncompromising <span className="italic">luxury</span>
        </h1>
        <p className="text-on-surface-variant mt-8 max-w-2xl leading-relaxed">
          A curated fleet of premium SUVs for executives and discerning travelers in Orlando —
          immaculate interiors and professional chauffeuring.
        </p>

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