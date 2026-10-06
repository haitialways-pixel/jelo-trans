export function ManagerPageSkeleton({
  title,
  cards = 0,
  rows = 6,
}: {
  title: string
  cards?: number
  rows?: number
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div>
        <h1 className="display text-2xl font-semibold">{title}</h1>
        <div className="mt-2 h-4 w-56 max-w-full rounded bg-primary/10" />
      </div>
      {cards > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="glass-dark gold-hairline rounded-2xl h-24" />
          ))}
        </div>
      ) : null}
      <div className="glass-dark gold-hairline rounded-2xl divide-y divide-outline-variant/15 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="h-4 w-2/3 rounded bg-primary/10" />
            <div className="h-3 w-1/2 rounded bg-primary/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
