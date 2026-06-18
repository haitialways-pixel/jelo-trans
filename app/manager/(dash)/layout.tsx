import { requireStaff } from '@/lib/manager/auth'
import { ManagerNav } from '@/components/manager/ManagerNav'
import { getRecentNotifications } from '@/lib/manager/notifications'

// Guard the ENTIRE manager dashboard here. Every child page/segment renders only
// after requireStaff() confirms an authenticated staff member — otherwise it
// redirects to /manager/login before any content is produced. (The login page
// lives outside this route group, so it is not affected.)
export default async function ManagerDashLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  // Initial payload for the notification bell. Realtime takes over after first paint.
  const initialNotifications = await getRecentNotifications(30)

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <ManagerNav staff={staff} initialNotifications={initialNotifications} />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">{children}</main>
    </div>
  )
}
