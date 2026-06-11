// Server-side helper to record operational notifications from places that DON'T
// go through a SECURITY DEFINER RPC (e.g. Stripe payment flows). Uses the admin
// client to bypass RLS — only callable from trusted server code.
//
// In-RPC events (new booking, cancellation, chat escalation, ride completed, ride
// cancelled by staff) are recorded automatically inside the DB function and do
// NOT need to call this helper.
import { createAdminClient } from '@/lib/supabase/admin'

export type OpsNotificationKind = 'deposit_paid' | 'balance_paid' | 'balance_failed'

export async function recordOpsNotification(input: {
  kind: OpsNotificationKind
  title: string
  body?: string | null
  reservationId?: string | null
  severity?: 'info' | 'warning' | 'critical'
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('notifications').insert({
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      reservation_id: input.reservationId ?? null,
      severity: input.severity ?? 'info',
    })
  } catch {
    // Notifications are auxiliary — never block the calling business action.
  }
}
