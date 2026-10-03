'use client'

export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg btn-cta text-sm font-semibold px-4 py-2 print:hidden"
    >
      {label}
    </button>
  )
}
