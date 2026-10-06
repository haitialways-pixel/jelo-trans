import { ManagerPageSkeleton } from '@/components/manager/ManagerPageSkeleton'

export default function DashboardLoading() {
  return <ManagerPageSkeleton title="Today at a glance" cards={4} rows={6} />
}
