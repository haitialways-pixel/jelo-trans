import Link from 'next/link'
import { Users, Briefcase } from 'lucide-react'
import type { Vehicle } from '@/lib/fleet'

const FALLBACK_IMAGE = '/images/fleet-overview.jpg'

/** Noir-et-Or studio card — image (spotlit) on the left, details on the right. DB-driven. */
export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const basePrice = Math.round(Number(vehicle.base_price))
  const mileRate = Number(vehicle.price_per_mile)
  const img = vehicle.image_url ?? FALLBACK_IMAGE
  const isNew = /\b(2024|2025|2026)\b/.test(vehicle.name)

  return (
    <article className="glass-dark gold-hairline rounded-2xl overflow-hidden group relative flex flex-col md:flex-row md:h-[320px] hover:bg-surface-container/60 transition-colors duration-500">
      {isNew && (
        <div className="absolute top-4 left-4 z-20 bg-background/80 backdrop-blur-md border border-primary/50 text-primary text-[10px] font-semibold tracking-widest px-3 py-1 rounded-full">
          NEW UNITS
        </div>
      )}

      <div className="w-full md:w-1/2 h-56 md:h-full relative spotlight-glow flex items-center justify-center p-5 bg-surface-container-lowest">
        <img
          src={img}
          alt={vehicle.name}
          className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-700"
        />
      </div>

      <div className="w-full md:w-1/2 p-7 flex flex-col justify-center border-t md:border-t-0 md:border-l border-outline-variant/20">
        <h3 className="display text-2xl font-semibold mb-2 leading-tight">{vehicle.name}</h3>
        {vehicle.description && (
          <p className="text-on-surface-variant text-sm leading-relaxed mb-5">{vehicle.description}</p>
        )}

        <div className="flex items-center gap-5 text-on-surface-variant text-xs mb-6 mt-auto">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" /> Up to {vehicle.capacity}
          </span>
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-primary" /> {vehicle.luggage_capacity} Bags
          </span>
          <span className="ml-auto text-primary font-semibold">${basePrice} base + ${mileRate}/mi</span>
        </div>

        <Link
          href="/book"
          className="block text-center border border-primary/40 text-primary hover:bg-primary hover:text-black font-semibold tracking-[0.15em] text-xs py-3 rounded-xl transition"
        >
          SELECT VEHICLE
        </Link>
      </div>
    </article>
  )
}
