import Link from 'next/link'
import { Users, Briefcase } from 'lucide-react'
import type { Vehicle } from '@/lib/fleet'
import { OptimizedImage } from '@/components/shared/OptimizedImage'

const FALLBACK_IMAGE = '/images/fleet-overview.webp'

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const basePrice = Math.round(Number(vehicle.base_price))
  const mileRate = Number(vehicle.price_per_mile)
  const img = vehicle.image_url ?? FALLBACK_IMAGE
  const isNew = /\b(2024|2025|2026)\b/.test(vehicle.name)

  return (
    <article className="float-card overflow-hidden group relative flex flex-col md:flex-row md:min-h-[340px]">
      {isNew && (
        <div className="absolute top-6 left-6 z-20 bg-background/90 backdrop-blur-sm text-[10px] tracking-widest uppercase text-on-surface-variant px-3 py-1 rounded-full">
          New units
        </div>
      )}

      <div className="w-full md:w-1/2 h-64 md:h-auto relative spotlight-glow flex items-center justify-center p-8 bg-surface-container-lowest">
        <OptimizedImage
          src={img}
          alt={vehicle.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain group-hover:scale-[1.03] transition-transform duration-700"
        />
      </div>

      <div className="w-full md:w-1/2 p-10 flex flex-col justify-center">
        <h3 className="font-display text-2xl md:text-3xl leading-tight">{vehicle.name}</h3>
        {vehicle.description && (
          <p className="text-on-surface-variant mt-4 leading-relaxed">{vehicle.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-6 text-on-surface-variant text-sm mt-8">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" strokeWidth={1.5} /> Up to {vehicle.capacity}
          </span>
          <span className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" strokeWidth={1.5} /> {vehicle.luggage_capacity} bags
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-4">
          ${basePrice} base + ${mileRate}/mi
        </p>

        <Link href="/book" className="btn-cta inline-block text-center text-xs mt-10 py-3.5 px-8 rounded-full tracking-widest">
          Select vehicle
        </Link>
      </div>
    </article>
  )
}