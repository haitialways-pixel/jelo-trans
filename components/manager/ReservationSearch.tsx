'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, X, Loader2 } from 'lucide-react'

export function ReservationSearch({
  defaultQuery = '',
  status = '',
}: {
  defaultQuery?: string
  status?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(defaultQuery)
  const [pending, start] = useTransition()

  function navigate(nextQuery: string) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    const trimmed = nextQuery.trim()
    if (trimmed) params.set('q', trimmed)
    const qs = params.toString()
    start(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(query)
  }

  function clear() {
    setQuery('')
    navigate('')
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-xl">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Last name, phone, or booking # (PH…)"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm bg-card border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/70"
          aria-label="Search reservations by last name, phone, or booking number"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-on-surface-variant hover:text-on-surface"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-gold text-sm font-semibold transition disabled:opacity-50 shrink-0"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        Search
      </button>
    </form>
  )
}