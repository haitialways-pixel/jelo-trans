'use client'

export function ExportCsvButton({
  filename,
  csv,
  label = 'Export CSV',
}: {
  filename: string
  csv: string
  label?: string
}) {
  function download() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      className="text-xs rounded-lg border border-outline-variant/40 px-3 py-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60"
    >
      {label}
    </button>
  )
}
