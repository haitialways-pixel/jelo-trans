'use client'

// Manager notification bell. Subscribes to the `notifications` table via Supabase
// Realtime → new INSERTs ring the bell instantly. Clicking the bell opens a
// dropdown listing recent notifications; clicking an item marks it read and
// (when relevant) navigates to the reservation.
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  markNotificationRead,
  markAllNotificationsRead,
  type ManagerNotification,
} from '@/lib/manager/notifications'

type Props = { initial: ManagerNotification[] }

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-secondary-dark',
  warning: 'bg-gold',
  critical: 'bg-red-500',
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function NotificationBell({ initial }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ManagerNotification[]>(initial)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const popRef = useRef<HTMLDivElement>(null)

  const unread = items.filter((n) => !n.read_at).length

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Realtime subscription — push new INSERTs into the list as they arrive.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('mgr-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new as ManagerNotification
          // Prepend and keep last 30 visible.
          setItems((prev) => [n, ...prev].slice(0, 30))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function handleClick(n: ManagerNotification) {
    setOpen(false)
    start(async () => {
      if (!n.read_at) {
        await markNotificationRead(n.id)
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
        )
      }
      if (n.reservation_id) {
        router.push(`/manager/reservations/${n.reservation_id}`)
      }
    })
  }

  function handleMarkAll() {
    start(async () => {
      await markAllNotificationsRead()
      const now = new Date().toISOString()
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })))
    })
  }

  return (
    <div ref={popRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-outline-variant/30 text-on-surface hover:text-primary hover:bg-primary/10 transition"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-hidden glass-dark gold-hairline rounded-2xl shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={pending}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-on-surface-variant">
                Nothing yet. New events will appear here in real time.
              </p>
            ) : (
              <ul className="divide-y divide-outline-variant/15">
                {items.map((n) => {
                  const isUnread = !n.read_at
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 transition hover:bg-surface-container/40 ${
                          isUnread ? 'bg-primary/[0.04]' : ''
                        }`}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                            SEVERITY_DOT[n.severity] ?? 'bg-outline-variant'
                          } ${isUnread ? '' : 'opacity-30'}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm truncate ${
                              isUnread ? 'font-semibold text-on-surface' : 'text-on-surface-variant'
                            }`}
                          >
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-on-surface-variant truncate mt-0.5">{n.body}</p>
                          )}
                          <p className="text-[10px] text-on-surface-variant/70 mt-1">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!isUnread && <Check className="w-3.5 h-3.5 text-on-surface-variant/50 shrink-0 mt-1" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
