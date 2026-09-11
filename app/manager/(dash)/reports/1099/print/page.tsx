import Link from 'next/link'
import { requireAdmin } from '@/lib/manager/auth'
import { getChauffeurs, getChauffeurTaxCipher } from '@/lib/manager/data'
import { driverPayRows, getReportReservations, resolveReportRange } from '@/lib/manager/reports'
import { formatFullTaxIdForPdf, maskTaxId, unsealTaxId } from '@/lib/manager/taxId'
import { PAYER_ADDRESS_LINES, PAYER_LEGAL_NAME, BRAND_PHONE, BRAND_EMAIL } from '@/lib/site'
import { formatMoneyExact } from '@/lib/manager/format'
import { PrintButton } from '@/components/manager/PrintButton'

export const dynamic = 'force-dynamic'

export default async function NecPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; id?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const year = Number(sp.year) || new Date().getFullYear()
  const onlyId = sp.id?.trim() || ''

  const range = resolveReportRange({
    preset: 'custom',
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  })
  const [chauffeurs, yearRows] = await Promise.all([
    getChauffeurs({ includeTaxLast4: true }),
    getReportReservations({
      fromIso: range.fromIso,
      toIso: range.toIso,
      status: 'completed',
    }),
  ])
  const chauffeur1099 = new Map(chauffeurs.map((c) => [c.id, c.is_1099_contractor]))
  const yearPay = driverPayRows(yearRows, chauffeur1099)

  const eligible = chauffeurs.filter((c) => {
    if (!c.is_1099_contractor) return false
    if (onlyId && c.id !== onlyId) return false
    const pay = yearPay.filter((j) => j.chauffeur_id === c.id).reduce((s, j) => s + j.driver_pay, 0)
    return pay > 0
  })

  const packets = await Promise.all(
    eligible.map(async (c) => {
      const jobs = yearPay.filter((j) => j.chauffeur_id === c.id)
      const box1 = jobs.reduce((s, j) => s + j.driver_pay, 0)
      const cipher = await getChauffeurTaxCipher(c.id)
      const full = await unsealTaxId(cipher)
      const missingAddress = !c.address_line1 || !c.city || !c.state || !c.zip
      return { c, jobs, box1, full, missingAddress }
    }),
  )

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/manager/reports" className="text-sm text-primary hover:underline">
          ← Back to reports
        </Link>
        <p className="text-xs text-on-surface-variant">Printable contractor statement. Not an IRS e-file.</p>
        <PrintButton />
      </div>

      {packets.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No eligible 1099 contractors for {year}.</p>
      ) : (
        packets.map(({ c, jobs, box1, full, missingAddress }) => (
          <article
            key={c.id}
            className="bg-white text-black rounded-none border border-neutral-300 p-8 mb-8 print:break-after-page print:border-0 print:mb-0"
          >
            {missingAddress && (
              <p className="text-center text-red-700 font-semibold uppercase tracking-widest text-sm mb-4">
                Address missing
              </p>
            )}
            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
              Form 1099-NEC style contractor statement
            </p>
            <h1 className="text-xl font-semibold mb-1">Nonemployee Compensation — {year}</h1>
            <p className="text-xs text-neutral-600 mb-6">
              Printable contractor statement for an accountant. Not an IRS e-file.
            </p>

            <div className="grid sm:grid-cols-2 gap-6 text-sm mb-6">
              <div>
                <p className="text-xs uppercase text-neutral-500 mb-1">Payer</p>
                <p className="font-semibold">{PAYER_LEGAL_NAME}</p>
                {PAYER_ADDRESS_LINES.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <p>{BRAND_PHONE}</p>
                <p>{BRAND_EMAIL}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-500 mb-1">Recipient</p>
                <p className="font-semibold">{c.legal_name || c.name}</p>
                {c.address_line1 && <p>{c.address_line1}</p>}
                {c.address_line2 && <p>{c.address_line2}</p>}
                <p>{[c.city, c.state, c.zip].filter(Boolean).join(', ')}</p>
                <p className="mt-2 font-mono text-xs">
                  TIN:{' '}
                  {full
                    ? formatFullTaxIdForPdf(full, c.tax_id_type)
                    : `${maskTaxId(c.tax_id_last4, c.tax_id_type)} — complete ID by hand`}
                </p>
              </div>
            </div>

            <div className="border border-neutral-800 p-4 mb-6">
              <p className="text-xs uppercase text-neutral-500">Box 1 — Nonemployee compensation</p>
              <p className="text-2xl font-semibold">{formatMoneyExact(box1)}</p>
              <p className="text-xs text-neutral-600 mt-1">{jobs.length} completed job(s) in {year}</p>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-300 text-left">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Booking</th>
                  <th className="py-1 font-medium text-right">Pay</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-neutral-100">
                    <td className="py-1">{j.pickup_time.slice(0, 10)}</td>
                    <td className="py-1 font-mono">{j.booking_number}</td>
                    <td className="py-1 text-right">{formatMoneyExact(j.driver_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))
      )}
    </div>
  )
}
