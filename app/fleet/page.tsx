import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { getFleet } from '@/lib/fleet'
import { VehicleCard } from '@/components/fleet/VehicleCard'

const TIER_ORDER = ['executive', 'premium'] as const
const TIER_LABELS: Record<string, string> = {
  executive: 'Executive SUV',
  premium: 'Premium SUV',
}

export const runtime = 'edge'

export default async function FleetPage() {
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
    <div className="bg-background text-on-surface min-h-screen">
      <Navbar />

      <div className="pt-28 pb-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-[11px] tracking-[0.3em] text-primary block mb-3">THE COLLECTION</span>
          <h1 className="display text-4xl md:text-6xl font-semibold leading-[1.05]">
            Uncompromising <span className="text-primary italic">Luxury</span>
          </h1>
          <p className="text-on-surface-variant mt-5 max-w-xl mx-auto">
            A curated fleet of premium SUVs designed for executives and discerning travelers in Orlando —
            immaculate interiors and professional chauffeuring.
          </p>
        </div>

        {grouped.map((g) => (
          <section key={g.tier} className="mb-14">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="display text-2xl font-semibold whitespace-nowrap">{g.label}</h2>
              <div className="flex-1 h-px bg-outline-variant/30" />
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              {g.items.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          </section>
        ))}

        {untiered.length > 0 && (
          <section className="mb-14">
            <div className="grid lg:grid-cols-2 gap-6">
              {untiered.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </div>
  )
}
