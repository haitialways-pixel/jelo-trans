'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Save, X, Loader2, Users, Pencil } from 'lucide-react'
import { upsertChauffeur, deleteChauffeur, getChauffeurTaxLast4 } from '@/lib/manager/actions'
import { maskTaxId } from '@/lib/manager/taxId'
import type { Chauffeur, TaxIdType } from '@/lib/manager/data'

type Props = {
  chauffeurs: Chauffeur[]
  isAdmin: boolean
}

type FormState = {
  id?: string
  name: string
  phone: string
  email: string
  driverLicenseId: string
  driverLicenseExpiresOn: string
  is1099Contractor: boolean
  legalName: string
  taxIdType: TaxIdType | ''
  taxId: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
}

const emptyForm = (): FormState => ({
  name: '',
  phone: '',
  email: '',
  driverLicenseId: '',
  driverLicenseExpiresOn: '',
  is1099Contractor: false,
  legalName: '',
  taxIdType: 'ssn',
  taxId: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
})

function licenseFlag(expiresOn: string | null): 'expired' | 'soon' | null {
  if (!expiresOn) return null
  const t = new Date(`${expiresOn}T00:00:00`).getTime()
  if (Number.isNaN(t)) return null
  const days = (t - Date.now()) / 86400000
  if (days < 0) return 'expired'
  if (days <= 30) return 'soon'
  return null
}

export function ChauffeurManager({ chauffeurs, isAdmin }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editing, setEditing] = useState(false)
  const [taxIdLast4, setTaxIdLast4] = useState('')

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(c: Chauffeur) {
    setEditing(true)
    setTaxIdLast4('')
    if (isAdmin) {
      void getChauffeurTaxLast4(c.id).then((result) => setTaxIdLast4(result.last4 ?? ''))
    }
    setForm({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      driverLicenseId: c.driver_license_id ?? '',
      driverLicenseExpiresOn: c.driver_license_expires_on ?? '',
      is1099Contractor: c.is_1099_contractor,
      legalName: c.legal_name ?? '',
      taxIdType: c.tax_id_type ?? 'ssn',
      taxId: '',
      addressLine1: c.address_line1 ?? '',
      addressLine2: c.address_line2 ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      zip: c.zip ?? '',
    })
  }

  function cancel() {
    setEditing(false)
    setTaxIdLast4('')
    setForm(emptyForm())
  }

  function save() {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.driverLicenseId.trim()) {
      toast.error('Driver ID is required')
      return
    }
    start(async () => {
      const res = await upsertChauffeur({
        id: form.id,
        name: form.name,
        phone: form.phone,
        email: form.email,
        driverLicenseId: form.driverLicenseId,
        driverLicenseExpiresOn: form.driverLicenseExpiresOn,
        is1099Contractor: form.is1099Contractor,
        legalName: form.legalName,
        taxIdType: isAdmin ? 'ssn' : '',
        taxId: isAdmin ? form.taxId : '',
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        state: form.state,
        zip: form.zip,
      })
      if (res.ok) {
        toast.success(form.id ? 'Chauffeur updated' : 'Chauffeur added')
        cancel()
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function remove(id: string, name: string) {
    if (!window.confirm(`Remove chauffeur "${name}"?`)) return
    start(async () => {
      const res = await deleteChauffeur(id)
      if (res.ok) {
        toast.success(`Chauffeur "${name}" removed`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-on-surface">
          {editing ? 'Edit chauffeur' : 'Add new chauffeur'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name *">
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="Driver ID *">
            <input
              value={form.driverLicenseId}
              onChange={(e) => set('driverLicenseId', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="License expiration">
            <input
              type="date"
              value={form.driverLicenseExpiresOn}
              onChange={(e) => set('driverLicenseExpiresOn', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is1099Contractor}
              onChange={(e) => set('is1099Contractor', e.target.checked)}
              disabled={pending}
            />
            1099 driver (contractor)
          </label>
          <Field label="Legal name (1099)">
            <input
              value={form.legalName}
              onChange={(e) => set('legalName', e.target.value)}
              placeholder="Defaults to name when printing"
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          {isAdmin && (
            <>
              <Field label="S.S.N." className="sm:col-span-2">
                <input
                  type="password"
                  autoComplete="off"
                  value={form.taxId}
                  onChange={(e) => set('taxId', e.target.value)}
                  placeholder={
                    form.id && chauffeurs.find((c) => c.id === form.id)?.hasTaxId
                      ? 'Leave blank to keep existing'
                      : 'Stored encrypted'
                  }
                  className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
                  disabled={pending}
                />
                {form.id && taxIdLast4 ? (
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    On file:{' '}
                    {maskTaxId(taxIdLast4, 'ssn')}
                  </p>
                ) : null}
              </Field>
            </>
          )}
          <Field label="Address line 1" className="sm:col-span-2">
            <input
              value={form.addressLine1}
              onChange={(e) => set('addressLine1', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <input
              value={form.addressLine2}
              onChange={(e) => set('addressLine2', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="City">
            <input
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="State">
            <input
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
          <Field label="ZIP">
            <input
              value={form.zip}
              onChange={(e) => set('zip', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-on-surface"
              disabled={pending}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {editing && (
            <button
              type="button"
              onClick={cancel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-outline-variant/40"
              disabled={pending}
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
          <button
            type="button"
            onClick={save}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-primary hover:bg-primary-dark text-black font-semibold"
            disabled={pending}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editing ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {editing ? 'Save chauffeur' : 'Add chauffeur'}
          </button>
        </div>
      </div>

      <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-on-surface">Chauffeurs ({chauffeurs.length})</h3>
        {chauffeurs.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            No chauffeurs configured. Chauffeurs can still be assigned by typing their name manually.
          </p>
        ) : (
          <div className="grid gap-2">
            {chauffeurs.map((c) => {
              const flag = licenseFlag(c.driver_license_expires_on)
              const incomplete1099 = c.is_1099_contractor && !c.hasTaxId
              return (
                <div
                  key={c.id}
                  className="glass-dark border border-outline-variant/10 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Users className="w-4 h-4 text-on-surface-variant shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-on-surface truncate">{c.name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                        {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact on file'}
                        {c.driver_license_id ? ` · ID ${c.driver_license_id}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {c.is_1099_contractor && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            1099
                          </span>
                        )}
                        {incomplete1099 && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800">
                            1099 incomplete
                          </span>
                        )}
                        {flag === 'expired' && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                            License expired
                          </span>
                        )}
                        {flag === 'soon' && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800">
                            License expires soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container/60"
                      title="Edit"
                      disabled={pending}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id, c.name)}
                      className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                      title="Remove"
                      disabled={pending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[11px] text-on-surface-variant uppercase font-medium">{label}</label>
      {children}
    </div>
  )
}
