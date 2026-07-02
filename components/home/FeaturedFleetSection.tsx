import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getFeaturedFleet } from '@/lib/fleet'
import { OptimizedImage } from '@/components/shared/OptimizedImage'

export async function FeaturedFleetSection() {
  const featured = await getFeaturedFleet(6)

  return (
    <section className="py-14 md:py-20">
      <div className="px-6 max-w-7xl mx-auto mb-6 flex justify-between items-end">
        <div>
          <span className="text-[11px] tracking-[0.25em] text-primary mb-2 block">COLLECTION</span>
          <h2 className="display text-3xl md:text-4xl font-semibold">Our Elite Fleet</h2>
        </div>
        <Link href="/fleet" className="text-primary text-[11px] tracking-widest border-b border-primary/30 pb-1 hover:text-on-surface transition shrink-0">
          VIEW ALL
        </Link>
      </div>
      <div className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory gap-4 px-6 pb-4 max-w-7xl mx-auto">
        {featured.map((v) => (
          <Link
            key={v.id}
            href="/book"
            className="snap-center shrink-0 w-[80%] sm:w-[360px] glass-dark gold-hairline rounded-2xl overflow-hidden p-4 group"
          >
            <div className="relative aspect-[16/10] mb-4 rounded-xl overflow-hidden bg-surface-container-lowest spotlight-glow flex items-center justify-center p-3">
              <OptimizedImage
                src={v.image_url ?? '/images/fleet-overview.webp'}
                alt={v.name}
                fill
                sizes="(max-width: 640px) 80vw, 360px"
                className="object-contain group-hover:scale-105 transition duration-700"
              />
              <div className="absolute top-3 right-3 bg-white/90 text-primary border border-primary/25 text-[10px] tracking-widest px-3 py-1 rounded-full uppercase shadow-sm">
                {v.tier ?? 'fleet'}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm tracking-widest text-on-surface font-semibold">{v.name}</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Up to {v.capacity} passengers · from ${Math.round(Number(v.base_price))} base
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-primary shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}