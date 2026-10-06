import { Suspense } from 'react'
import { requireStaff } from '@/lib/manager/auth'
import { ManagerNav } from '@/components/manager/ManagerNav'
import { NotificationBell } from '@/components/manager/NotificationBell'
import { NotificationBellLoader } from '@/components/manager/NotificationBellLoader'

// Guard the ENTIRE manager dashboard here. Every child page/segment renders only
// after requireStaff() confirms an authenticated staff member — otherwise it
// redirects to /manager/login before any content is produced. (The login page
// lives outside this route group, so it is not affected.)
export default async function ManagerDashLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()

  return (
    <div className="manager-app min-h-screen bg-background text-on-surface">
      <ManagerNav
        staff={staff}
        notifications={
          <Suspense fallback={<NotificationBell />}>
            <NotificationBellLoader />
          </Suspense>
        }
      />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">{children}</main>
    </div>
  )
}
