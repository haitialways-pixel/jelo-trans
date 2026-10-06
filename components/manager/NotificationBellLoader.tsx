import { getRecentNotifications } from '@/lib/manager/notifications'
import { NotificationBell } from './NotificationBell'

export async function NotificationBellLoader() {
  const initial = await getRecentNotifications(30)
  return <NotificationBell initial={initial} />
}
