'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserCog, Send } from 'lucide-react'
import { assignReservation, sendDriverDispatchNotification } from '@/lib/manager/actions'
import type { ManagerReservation, VehicleUnit, Chauffeur } from '@/lib/manager/data'

export function AssignForm({
  r,
  units,
  chauffeurs = [],
}: {
  r: ManagerReservation
  units: VehicleUnit[]
  chauffeurs: Chauffeur[]
}) {
  const [unitId, setUnitId] = useState(r.assigned_unit_id ?? '')
  const [chauffeurId, setChauffeurId] = useState(r.chauffeur_id ?? '')
  const [chauffeur, setChauffeur] = useState(r.chauffeur_name ?? '')

  const isPredefined = chauffeurs.some((c) => c.id === (r.chauffeur_id ?? '') || c.name === (r.chauffeur_name ?? ''))
  const [selectMode, setSelectMode] = useState<'select' | 'manual'>(
    !r.chauffeur_name || isPredefined ? 'select' : 'manual',
  )

  const [pending, start] = useTransition()
  const router = useRouter()

  const disabled = r.status === 'cancelled' || r.status === 'completed'

  const matchingUnits = units.filter((u) => u.model_id === r.vehicle_id)
  const otherUnits = units.filter((u) => u.model_id !== r.vehicle_id)

  const handleAutoAssign = () => {
    const availableMatching = matchingUnits.find((u) => u.status === 'available')
    if (availableMatching) {
      setUnitId(availableMatching.id)
      toast.success(`Auto-assigned: ${availableMatching.label}`)
    } else {
      toast.error('No available vehicle found in this category')
    }
  }

  function save() {
    start(async () => {
      const res = await assignReservation(r.id, unitId || null, chauffeur, chauffeurId || null)
      if (res.ok) {
        toast.success('Assignment saved')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function dispatchDriver() {
    start(async () => {
      const res = await sendDriverDispatchNotification(r.id)
      if (res.ok) {
        toast.success('Dispatch notification sent to driver')
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs text-on-surface-variant">
            Booked category: <span className="text-white font-semibold">{r.fleet?.name ?? 'Unassigned'}</span>
          </label>
          {!unitId && !disabled && matchingUnits.length > 0 && (
            <button
              onClick={handleAutoAssign}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              Auto-Assign
            </button>
          )}
        </div>
        <select
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-50 text-white bg-[#1a1a1a] border border-[#2d2d2d]"
        >
          <option value="">— No specific car —</option>
          {matchingUnits.length > 0 && (
            <optgroup label={`Recommended for ${r.fleet?.name}`}>
              {matchingUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} {u.status !== 'available' ? `(${u.status})` : '(available)'}
                </option>
              ))}
            </optgroup>
          )}
          {otherUnits.length > 0 && (
            <optgroup label="Other vehicle classes">
              {otherUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} — {u.model?.name} {u.status !== 'available' ? `(${u.status})` : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="text-[11px] text-on-surface-variant mt-1">Assign a specific vehicle from the fleet.</p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-xs text-on-surface-variant">Chauffeur</label>
          {selectMode === 'manual' ? (
            <button
              onClick={() => {
                setSelectMode('select')
                setChauffeur('')
                setChauffeurId('')
              }}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              Select from list
            </button>
          ) : (
            <button
              onClick={() => {
                setSelectMode('manual')
                setChauffeurId('')
              }}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              Enter manually
            </button>
          )}
        </div>

        {selectMode === 'select' ? (
          <select
            value={chauffeurId || chauffeur}
            onChange={(e) => {
              if (e.target.value === '__manual__') {
                setSelectMode('manual')
                setChauffeurId('')
              } else {
                const selected = chauffeurs.find((c) => c.id === e.target.value)
                setChauffeurId(selected?.id ?? '')
                setChauffeur(selected?.name ?? '')
              }
            }}
            disabled={disabled}
            className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-50 text-white bg-[#1a1a1a] border border-[#2d2d2d]"
          >
            <option value="">— Unassigned —</option>
            {chauffeurs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` (${c.phone})` : ''}
                {c.email ? ` · ${c.email}` : ''}
              </option>
            ))}
            <option value="__manual__">Manual Entry...</option>
          </select>
        ) : (
          <input
            type="text"
            value={chauffeur}
            onChange={(e) => {
              setChauffeur(e.target.value)
              setChauffeurId('')
            }}
            disabled={disabled}
            placeholder="Enter driver name"
            className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-50 text-white bg-[#1a1a1a] border border-[#2d2d2d]"
          />
        )}
      </div>

      <button
        onClick={save}
        disabled={pending || disabled}
        className="flex items-center justify-center gap-2 w-full rounded-xl border border-primary/40 text-primary hover:bg-primary/10 text-sm font-medium py-2.5 transition disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
        Save assignment
      </button>

      {!disabled && (chauffeurId || chauffeur) && (
        <button
          onClick={dispatchDriver}
          disabled={pending}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-sm font-medium py-2.5 transition disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send dispatch to driver
        </button>
      )}
    </div>
  )
}