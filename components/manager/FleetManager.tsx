'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Loader2, 
  Car, 
  Tag, 
  Calendar,
  AlertCircle,
  Users,
  Image as ImageIcon,
  DollarSign
} from 'lucide-react'
import { 
  updateFleetPricing, 
  addVehicleUnit, 
  updateVehicleUnit, 
  deleteVehicleUnit,
  setUnitStatus,
  createFleetModel,
  deleteFleetModel,
  addChauffeur,
  deleteChauffeur
} from '@/lib/manager/actions'
import type { ManagerFleetModel, VehicleUnit, Chauffeur } from '@/lib/manager/data'

type Props = {
  models: ManagerFleetModel[]
  units: VehicleUnit[]
  chauffeurs: Chauffeur[]
}

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_service', label: 'In service' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unavailable', label: 'Unavailable' },
]

const TYPE_OPTIONS = [
  { value: 'luxury_sedan', label: 'Luxury Sedan' },
  { value: 'executive_suburban', label: 'Executive SUV / Suburban' },
  { value: 'luxury_suv', label: 'Luxury SUV' },
  { value: 'sprinter_van', label: 'Sprinter Limo Van' },
  { value: 'stretch_limo', label: 'Stretch Limo' },
  { value: 'party_bus', label: 'Party Bus' },
]

export function FleetManager({ models, units, chauffeurs }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [activeTab, setActiveTab] = useState<'fleet' | 'chauffeurs'>('fleet')

  // State for adding a vehicle class (model)
  const [showAddClass, setShowAddClass] = useState(false)
  const [className, setClassName] = useState('')
  const [classType, setClassType] = useState('luxury_sedan')
  const [classCapacity, setClassCapacity] = useState('4')
  const [classLuggage, setClassLuggage] = useState('4')
  const [classBasePrice, setClassBasePrice] = useState('')
  const [classPricePerMile, setClassPricePerMile] = useState('')
  const [classImageUrl, setClassImageUrl] = useState('')
  const [classDesc, setClassDesc] = useState('')
  const [classTier, setClassTier] = useState('premium')

  // State for pricing edits
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [basePrice, setBasePrice] = useState<number>(0)
  const [pricePerMile, setPricePerMile] = useState<number>(0)
  const [minimumPrice, setMinimumPrice] = useState<number>(0)

  // State for adding a unit (physical car)
  const [addingUnitModelId, setAddingUnitModelId] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newYear, setNewYear] = useState('')
  const [newPlate, setNewPlate] = useState('')

  // State for editing a unit (physical car)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editPlate, setEditPlate] = useState('')

  // State for adding a chauffeur
  const [chauffeurName, setChauffeurName] = useState('')
  const [chauffeurPhone, setChauffeurPhone] = useState('')

  const handleCreateClass = () => {
    if (!className.trim()) {
      toast.error('Class name is required')
      return
    }
    const base = parseFloat(classBasePrice)
    const perMile = parseFloat(classPricePerMile)
    if (isNaN(base) || base <= 0 || isNaN(perMile) || perMile <= 0) {
      toast.error('Pricing values must be positive numbers')
      return
    }

    start(async () => {
      const res = await createFleetModel(
        className.trim(),
        classType,
        parseInt(classCapacity) || 4,
        parseInt(classLuggage) || 4,
        base,
        perMile,
        classImageUrl.trim(),
        classDesc.trim(),
        classTier
      )
      if (res.ok) {
        toast.success('Vehicle class created')
        setClassName('')
        setClassBasePrice('')
        setClassPricePerMile('')
        setClassImageUrl('')
        setClassDesc('')
        setShowAddClass(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleDeleteClass = (modelId: string, name: string) => {
    if (!window.confirm(`Delete vehicle class "${name}"? This will also delete all physical cars in this class.`)) return
    start(async () => {
      const res = await deleteFleetModel(modelId)
      if (res.ok) {
        toast.success(`Class "${name}" deleted`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleSavePrice = (modelId: string) => {
    if (basePrice <= 0 || pricePerMile <= 0) {
      toast.error('Base and per-mile prices must be positive numbers')
      return
    }
    if (minimumPrice < 0) {
      toast.error('Minimum price cannot be negative')
      return
    }
    start(async () => {
      const res = await updateFleetPricing(modelId, basePrice, pricePerMile, minimumPrice)
      if (res.ok) {
        toast.success('Pricing updated successfully')
        setEditingPriceId(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleAddUnit = (modelId: string) => {
    if (!newLabel.trim()) {
      toast.error('Vehicle name/label is required')
      return
    }
    start(async () => {
      const res = await addVehicleUnit(
        modelId,
        newLabel.trim(),
        parseInt(newYear) || 0,
        newPlate.trim()
      )
      if (res.ok) {
        toast.success('Vehicle added successfully')
        setNewLabel('')
        setNewYear('')
        setNewPlate('')
        setAddingUnitModelId(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleSaveUnit = (unitId: string) => {
    if (!editLabel.trim()) {
      toast.error('Vehicle name/label is required')
      return
    }
    start(async () => {
      const res = await updateVehicleUnit(
        unitId,
        editLabel.trim(),
        parseInt(editYear) || 0,
        editPlate.trim()
      )
      if (res.ok) {
        toast.success('Vehicle details updated')
        setEditingUnitId(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleDeleteUnit = (unitId: string, label: string) => {
    if (!window.confirm(`Are you sure you want to remove ${label}?`)) return
    start(async () => {
      const res = await deleteVehicleUnit(unitId)
      if (res.ok) {
        toast.success(`${label} removed from fleet`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleStatusChange = (unitId: string, status: string) => {
    start(async () => {
      const res = await setUnitStatus(unitId, status)
      if (res.ok) {
        toast.success('Status updated')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleAddChauffeur = () => {
    if (!chauffeurName.trim()) {
      toast.error('Chauffeur name is required')
      return
    }
    start(async () => {
      const res = await addChauffeur(chauffeurName.trim(), chauffeurPhone.trim())
      if (res.ok) {
        toast.success('Chauffeur added')
        setChauffeurName('')
        setChauffeurPhone('')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleDeleteChauffeur = (id: string, name: string) => {
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

  const handleStartEditPrice = (model: ManagerFleetModel) => {
    setEditingPriceId(model.id)
    setBasePrice(model.base_price)
    setPricePerMile(model.price_per_mile)
    setMinimumPrice(model.minimum_price ?? 0)
  }

  const handleStartEditUnit = (unit: VehicleUnit) => {
    setEditingUnitId(unit.id)
    setEditLabel(unit.label)
    setEditYear(unit.year ? String(unit.year) : '')
    setEditPlate(unit.license_plate ?? '')
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-outline-variant/20 gap-4">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`pb-2.5 text-sm font-medium transition border-b-2 px-1 ${
            activeTab === 'fleet' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-white'
          }`}
        >
          Manage Fleet
        </button>
        <button
          onClick={() => setActiveTab('chauffeurs')}
          className={`pb-2.5 text-sm font-medium transition border-b-2 px-1 ${
            activeTab === 'chauffeurs' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-white'
          }`}
        >
          Manage Chauffeurs
        </button>
      </div>

      {activeTab === 'fleet' && (
        <div className="space-y-6">
          {/* Create new vehicle class button */}
          <div className="flex justify-end">
            {!showAddClass && (
              <button
                onClick={() => setShowAddClass(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-primary hover:bg-primary-dark text-black font-semibold transition"
              >
                <Plus className="w-4 h-4" /> Create Vehicle Class
              </button>
            )}
          </div>

          {/* Create vehicle class form */}
          {showAddClass && (
            <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-2">
                <h3 className="text-sm font-semibold text-white">Create New Vehicle Class (Category)</h3>
                <button onClick={() => setShowAddClass(false)} className="text-on-surface-variant hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Class Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Stretch Limo"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-on-surface-variant uppercase font-medium">System Type Mapping</label>
                  <select
                    value={classType}
                    onChange={(e) => setClassType(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Service Tier</label>
                  <select
                    value={classTier}
                    onChange={(e) => setClassTier(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="premium">Premium</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00"
                    value={classBasePrice}
                    onChange={(e) => setClassBasePrice(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Price Per Mile ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 4.50"
                    value={classPricePerMile}
                    onChange={(e) => setClassPricePerMile(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Max Pax</label>
                      <input
                        type="number"
                        value={classCapacity}
                        onChange={(e) => setClassCapacity(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Max Luggage</label>
                      <input
                        type="number"
                        value={classLuggage}
                        onChange={(e) => setClassLuggage(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Image URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. /images/stretch-limo.jpg"
                    value={classImageUrl}
                    onChange={(e) => setClassImageUrl(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Description (Optional)</label>
                  <textarea
                    placeholder="Describe this vehicle class for customers..."
                    value={classDesc}
                    onChange={(e) => setClassDesc(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs text-white h-16 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/10">
                <button
                  onClick={() => setShowAddClass(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-outline-variant/40 hover:bg-surface-container/50 text-white transition"
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClass}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-primary hover:bg-primary-dark text-black font-semibold transition"
                  disabled={pending}
                >
                  {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Class
                </button>
              </div>
            </div>
          )}

          {/* Vehicle Classes List */}
          <div className="space-y-6">
            {models.map((model) => {
              const modelUnits = units.filter((u) => u.model_id === model.id)
              const isEditingPrice = editingPriceId === model.id
              const isAddingUnit = addingUnitModelId === model.id

              return (
                <div 
                  key={model.id} 
                  className="glass-dark gold-hairline rounded-2xl p-6 space-y-6 transition hover:border-primary/20"
                >
                  {/* Class Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/10 pb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-white">{model.name}</h2>
                        {model.tier && (
                          <span className="text-[10px] font-semibold tracking-wider uppercase bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-0.5">
                            {model.tier}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Type: <span className="font-mono text-white">{model.type}</span> · Capacity: {model.capacity} Pax, {model.luggage_capacity} Bags
                      </p>
                    </div>

                    {/* Pricing Edit Form */}
                    <div className="flex items-center gap-4">
                      {isEditingPrice ? (
                        <div className="flex flex-wrap items-center gap-3 bg-surface-container/60 border border-outline-variant/30 rounded-xl p-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] text-on-surface-variant uppercase">Base Price ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={basePrice}
                              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                              className="w-20 rounded-md px-2 py-1 text-xs text-white"
                              disabled={pending}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-on-surface-variant uppercase">Price / Mile ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={pricePerMile}
                              onChange={(e) => setPricePerMile(parseFloat(e.target.value) || 0)}
                              className="w-20 rounded-md px-2 py-1 text-xs text-white"
                              disabled={pending}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-on-surface-variant uppercase">Minimum ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={minimumPrice}
                              onChange={(e) => setMinimumPrice(parseFloat(e.target.value) || 0)}
                              className="w-20 rounded-md px-2 py-1 text-xs text-white"
                              disabled={pending}
                              title="Minimum charge per ride for this model"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 self-end">
                            <button
                              onClick={() => handleSavePrice(model.id)}
                              disabled={pending}
                              className="flex items-center justify-center p-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition"
                            >
                              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setEditingPriceId(null)}
                              disabled={pending}
                              className="flex items-center justify-center p-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 bg-surface-container/30 border border-outline-variant/15 rounded-xl px-4 py-2.5">
                          <div className="text-right">
                            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Pricing</p>
                            <p className="text-sm font-semibold text-primary">
                              ${model.base_price.toFixed(2)} base + ${model.price_per_mile.toFixed(2)}/mile
                            </p>
                            {model.minimum_price > 0 && (
                              <p className="text-[10px] text-on-surface-variant mt-0.5">
                                min ride: <span className="text-white font-semibold">${model.minimum_price.toFixed(2)}</span>
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleStartEditPrice(model)}
                            className="text-xs text-primary-light border border-primary/30 hover:bg-primary/15 rounded-lg px-2.5 py-1.5 font-medium transition"
                          >
                            Edit Price
                          </button>
                          <button
                            onClick={() => handleDeleteClass(model.id, model.name)}
                            className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                            title="Delete class"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Physical Vehicles Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs tracking-wider text-on-surface-variant uppercase font-medium">
                        Physical Inventory ({modelUnits.length} units)
                      </h3>
                      {!isAddingUnit && (
                        <button
                          onClick={() => setAddingUnitModelId(model.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Car
                        </button>
                      )}
                    </div>

                    {/* Add new physical unit form */}
                    {isAddingUnit && (
                      <div className="glass-dark border border-dashed border-primary/30 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                          <h4 className="text-xs font-semibold text-primary">Add New Vehicle Unit</h4>
                          <button onClick={() => setAddingUnitModelId(null)} className="text-on-surface-variant hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] text-on-surface-variant uppercase">Vehicle Name (Label)</label>
                            <input
                              type="text"
                              placeholder="e.g. Cadillac XTS Black #1"
                              value={newLabel}
                              onChange={(e) => setNewLabel(e.target.value)}
                              className="w-full rounded-lg px-3 py-2 text-xs text-white"
                              disabled={pending}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-on-surface-variant uppercase">Year (Optional)</label>
                            <input
                              type="number"
                              placeholder="e.g. 2023"
                              value={newYear}
                              onChange={(e) => setNewYear(e.target.value)}
                              className="w-full rounded-lg px-3 py-2 text-xs text-white"
                              disabled={pending}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-on-surface-variant uppercase">License Plate (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. TX-12345"
                              value={newPlate}
                              onChange={(e) => setNewPlate(e.target.value)}
                              className="w-full rounded-lg px-3 py-2 text-xs text-white"
                              disabled={pending}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setAddingUnitModelId(null)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant/40 hover:bg-surface-container/50 text-white transition"
                            disabled={pending}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAddUnit(model.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary hover:bg-primary-dark text-black font-semibold transition"
                            disabled={pending}
                          >
                            {pending && <Loader2 className="w-3 h-3 animate-spin" />}
                            Add Car
                          </button>
                        </div>
                      </div>
                    )}

                    {modelUnits.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-xl bg-surface-container/20 border border-outline-variant/10 p-4 text-xs text-on-surface-variant">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        No physical cars added to this class. Customers cannot book this class unless at least one available vehicle unit exists.
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {modelUnits.map((unit) => {
                          const isEditingUnit = editingUnitId === unit.id

                          return (
                            <div
                              key={unit.id}
                              className="glass-dark border border-outline-variant/10 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 hover:border-outline-variant/30 transition"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Car className="w-4 h-4 text-on-surface-variant shrink-0" />
                                {isEditingUnit ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-w-0">
                                    <input
                                      type="text"
                                      value={editLabel}
                                      onChange={(e) => setEditLabel(e.target.value)}
                                      className="rounded px-2 py-1 text-xs text-white"
                                      placeholder="Label"
                                      disabled={pending}
                                    />
                                    <input
                                      type="number"
                                      value={editYear}
                                      onChange={(e) => setEditYear(e.target.value)}
                                      className="rounded px-2 py-1 text-xs text-white"
                                      placeholder="Year"
                                      disabled={pending}
                                    />
                                    <input
                                      type="text"
                                      value={editPlate}
                                      onChange={(e) => setEditPlate(e.target.value)}
                                      className="rounded px-2 py-1 text-xs text-white"
                                      placeholder="Plate"
                                      disabled={pending}
                                    />
                                  </div>
                                ) : (
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate text-white">{unit.label}</p>
                                    <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5">
                                      {unit.year && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3" /> {unit.year}
                                        </span>
                                      )}
                                      {unit.license_plate && (
                                        <span className="flex items-center gap-1 font-mono">
                                          <Tag className="w-3 h-3" /> {unit.license_plate}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Unit Actions */}
                              <div className="flex items-center gap-3">
                                {isEditingUnit ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleSaveUnit(unit.id)}
                                      disabled={pending}
                                      className="p-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition"
                                      title="Save changes"
                                    >
                                      {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      onClick={() => setEditingUnitId(null)}
                                      disabled={pending}
                                      className="p-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <select
                                      value={unit.status}
                                      onChange={(e) => handleStatusChange(unit.id, e.target.value)}
                                      disabled={pending}
                                      className="rounded-lg px-2 py-1 text-[11px] bg-surface-container border border-outline-variant/20 text-white disabled:opacity-50"
                                    >
                                      {STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>

                                    <button
                                      onClick={() => handleStartEditUnit(unit)}
                                      className="p-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-white hover:bg-surface-container/50 transition"
                                      title="Edit car details"
                                      disabled={pending}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteUnit(unit.id, unit.label)}
                                      className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                                      title="Delete vehicle"
                                      disabled={pending}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'chauffeurs' && (
        <div className="space-y-6">
          {/* Add chauffeur form */}
          <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Add New Chauffeur</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Chauffeur Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jean Dupont"
                  value={chauffeurName}
                  onChange={(e) => setChauffeurName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-on-surface-variant uppercase font-medium">Phone Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. +1 (555) 019-2834"
                  value={chauffeurPhone}
                  onChange={(e) => setChauffeurPhone(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs text-white"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleAddChauffeur}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-primary hover:bg-primary-dark text-black font-semibold transition"
                disabled={pending}
              >
                {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Chauffeur
              </button>
            </div>
          </div>

          {/* Chauffeurs List */}
          <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Chauffeurs List ({chauffeurs.length} drivers)</h3>
            {chauffeurs.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No chauffeurs configured. Chauffeurs can still be assigned by typing their name manually.</p>
            ) : (
              <div className="grid gap-2">
                {chauffeurs.map((c) => (
                  <div
                    key={c.id}
                    className="glass-dark border border-outline-variant/10 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-on-surface-variant shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-white">{c.name}</p>
                        {c.phone && <p className="text-xs text-on-surface-variant mt-0.5">{c.phone}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteChauffeur(c.id, c.name)}
                      className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                      title="Remove Chauffeur"
                      disabled={pending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
