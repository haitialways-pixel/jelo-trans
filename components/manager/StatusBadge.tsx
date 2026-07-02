import { STATUS_LABELS, STATUS_STYLES } from '@/lib/manager/format'

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-surface-container text-on-surface-variant border-outline-variant'
  const label = STATUS_LABELS[status] ?? status
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${style}`}
    >
      {label}
    </span>
  )
}
