import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getFeaturedFleet } from '@/lib/fleet'
import { OptimizedImage } from '@/components/shared/OptimizedImage'

export async function FeaturedFleetSection() {
  const featured = await getFeaturedFleet(6)

  return (
    <section className="section-pad bg-surface-container-low">
      <div className="max-w-6xl mx-auto px-8 md:px-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.3em] uppercase text-on-surface-variant mb-6">Collection</p>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-tight">Our elite fleet</h2>
          </div>
          <Link
            href="/fleet"
            className="text-sm text-on-surface-variant hover:text-on-surface transition shrink-0"
          >
            View all vehicles →
          </Link>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory gap-8 pb-4 -mx-2 px-2">
          {featured.map((v) => (
            <Link
              key={v.id}
              href="/book"
              className="snap-center shrink-0 w-[85%] sm:w-[340px] float-card overflow-hidden p-8 group"
            >
              <div className="relative aspect-[16/10] mb-8 rounded-xl overflow-hidden bg-surface-container-lowest spotlight-glow flex items-center justify-center p-4">
                <OptimizedImage
                  src={v.image_url ?? '/images/fleet-overview.webp'}
                  alt={v.name}
                  fill
                  sizes="(max-width: 640px) 85vw, 340px"
                  className="object-contain group-hover:scale-[1.03] transition duration-700"
                />
              </div>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-display text-xl">{v.name}</h3>
                  <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                    Up to {v.capacity} passengers · from ${Math.round(Number(v.base_price))} base
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gold shrink-0 mt-1" strokeWidth={1.5} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}