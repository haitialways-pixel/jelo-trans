export function FeaturedFleetSkeleton() {
  return (
    <section className="py-14 md:py-20" aria-hidden="true">
      <div className="px-6 max-w-7xl mx-auto mb-6">
        <div className="h-3 w-24 bg-outline-variant/30 rounded animate-pulse mb-2" />
        <div className="h-9 w-56 bg-outline-variant/30 rounded animate-pulse" />
      </div>
      <div className="flex gap-4 px-6 pb-4 max-w-7xl mx-auto overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="shrink-0 w-[80%] sm:w-[360px] glass-dark gold-hairline rounded-2xl overflow-hidden p-4"
          >
            <div className="aspect-[16/10] mb-4 rounded-xl bg-outline-variant/20 animate-pulse" />
            <div className="h-4 w-3/4 bg-outline-variant/20 rounded animate-pulse mb-2" />
            <div className="h-3 w-1/2 bg-outline-variant/20 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  )
}