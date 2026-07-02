export function BookingWizardSkeleton() {
  return (
    <div className="card p-8 md:p-10 max-w-3xl mx-auto space-y-6" aria-hidden="true">
      <div className="flex justify-center gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-2 w-20 rounded-full bg-outline-variant/25 animate-pulse" />
        ))}
      </div>
      <div className="h-8 w-48 mx-auto bg-outline-variant/25 rounded animate-pulse" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-12 bg-outline-variant/20 rounded-xl animate-pulse" />
        <div className="h-12 bg-outline-variant/20 rounded-xl animate-pulse" />
      </div>
      <div className="h-12 bg-outline-variant/20 rounded-xl animate-pulse" />
      <div className="h-12 bg-primary/20 rounded-xl animate-pulse" />
    </div>
  )
}