import { createAdminClient } from '@/lib/supabase/admin'
import { assertStaff } from '@/lib/manager/auth'

/** Verified staff session + service-role client for manager data access. */
export async function staffDb() {
  await assertStaff()
  return createAdminClient()
}