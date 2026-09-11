import { getFleetModels, getVehicleUnits, getChauffeurs } from '@/lib/manager/data'
import { FleetManager } from '@/components/manager/FleetManager'
import { requireStaff, isAdminRole } from '@/lib/manager/auth'

export const dynamic = 'force-dynamic'

export default async function FleetPage() {
  const staff = await requireStaff()
  const [models, units, chauffeurs] = await Promise.all([
    getFleetModels(),
    getVehicleUnits(),
    getChauffeurs({ includeTaxLast4: isAdminRole(staff.role) }),
  ])

  const availableCount = units.filter((u) => u.status === 'available').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-2xl font-semibold">Fleet Operations</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          {availableCount} of {units.length} vehicles available · {models.length} vehicle classes · {chauffeurs.length} chauffeurs
        </p>
      </div>

      <FleetManager models={models} units={units} chauffeurs={chauffeurs} isAdmin={isAdminRole(staff.role)} />
    </div>
  )
}
