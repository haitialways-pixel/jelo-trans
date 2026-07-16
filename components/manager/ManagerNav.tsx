'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, CalendarRange, Car, Receipt, LogOut } from 'lucide-react'
import type { StaffSession } from '@/lib/manager/auth'
import type { ManagerNotification } from '@/lib/manager/notifications'
import { NotificationBell } from './NotificationBell'

const LINKS = [
  { href: '/manager', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/manager/reservations', label: 'Reservations', icon: CalendarRange, exact: false },
  { href: '/manager/receipts', label: 'Receipts', icon: Receipt, exact: false },
  { href: '/manager/fleet', label: 'Fleet', icon: Car, exact: false },
]

export function ManagerNav({
  staff,
  initialNotifications,
}: {
  staff: StaffSession
  initialNotifications: ManagerNotification[]
}) {
  const pathname = usePathname()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/manager/login'
  }

  return (
    <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-outline-variant/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/manager" className="display text-lg font-semibold">
            Imperial Odyssey <span className="text-on-surface-variant">Ops</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map((l) => {
              const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
                  }`}
                >
                  <l.icon className="w-4 h-4" />
                  {l.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell initial={initialNotifications} />
          <div className="text-right hidden sm:block">
            <p className="text-sm leading-tight">{staff.fullName ?? staff.email}</p>
            <p className="text-[11px] text-on-surface-variant capitalize">{staff.role}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-red-700 hover:bg-red-50 border border-outline-variant/40 rounded-lg px-3 py-2 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto hide-scrollbar">
        {LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${
                active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
              }`}
            >
              <l.icon className="w-3.5 h-3.5" />
              {l.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
