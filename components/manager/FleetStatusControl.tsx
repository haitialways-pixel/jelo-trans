'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { setUnitStatus } from '@/lib/manager/actions'

const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'in_service', label: 'In service' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unavailable', label: 'Unavailable' },
]

export function FleetStatusControl({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  function onChange(next: string) {
    if (next === status) return
    start(async () => {
      const res = await setUnitStatus(id, next)
      if (res.ok) {
        toast.success('Vehicle status updated')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {pending && <Loader2 className="w-3.5 h-3.5 animate-spin text-on-surface-variant" />}
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-50"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
