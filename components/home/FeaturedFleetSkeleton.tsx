export function FeaturedFleetSkeleton() {
  return (
    <section className="section-pad bg-surface-container-low" aria-hidden="true">
      <div className="max-w-6xl mx-auto px-8 md:px-12">
        <div className="h-3 w-28 bg-surface-container-high/60 rounded animate-pulse mb-6" />
        <div className="h-12 w-64 bg-surface-container-high/60 rounded animate-pulse mb-16" />
        <div className="flex gap-8 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shrink-0 w-[85%] sm:w-[340px] float-card p-8">
              <div className="aspect-[16/10] mb-8 rounded-xl bg-surface-container-high/50 animate-pulse" />
              <div className="h-5 w-3/4 bg-surface-container-high/50 rounded animate-pulse mb-3" />
              <div className="h-4 w-1/2 bg-surface-container-high/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}