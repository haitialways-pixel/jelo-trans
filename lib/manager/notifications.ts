// Server-side data access for the manager notification bell.
// Reads + mark-as-read pass through RLS (staff-only). Inserts are NEVER done from
// here — they happen automatically inside SECURITY DEFINER RPCs (create_reservation,
// cancel_guest_reservation, staff_advance_reservation, create_support_request) and
// directly from server actions for Stripe-side events (see lib/manager/actions.ts
// and app/api/stripe/webhook for those).
'use server'

import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/manager/auth'
import { staffDb } from '@/lib/manager/db'
import { revalidatePath } from 'next/cache'

export type NotificationKind =
  | 'new_booking'
  | 'deposit_paid'
  | 'balance_paid'
  | 'balance_failed'
  | 'cancellation'
  | 'chat_escalation'
  | 'ride_completed'

export type ManagerNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  reservation_id: string | null
  severity: 'info' | 'warning' | 'critical'
  read_at: string | null
  created_at: string
}

/** Most recent notifications (default 30). */
export async function getRecentNotifications(limit = 30): Promise<ManagerNotification[]> {
  const supabase = await staffDb()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, reservation_id, severity, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as unknown as ManagerNotification[]
}

/** How many unread are there right now? (small query, cheap to call). */
export async function getUnreadCount(): Promise<number> {
  const supabase = await staffDb()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

export type ActionResult = { ok: true } | { ok: false; error: string }

/** Mark a single notification as read. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/manager')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}

/** Mark every unread notification as read. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    await assertStaff()
    const supabase = await createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/manager')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action failed' }
  }
}
