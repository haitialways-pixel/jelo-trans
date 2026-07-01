'use client'

import { Suspense, useActionState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { managerLogin, type LoginState } from './actions'
import { Lock, Loader2 } from 'lucide-react'

export default function ManagerLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const params = useSearchParams()
  const notStaff = params.get('error') === 'not_staff'
  const [state, formAction, pending] = useActionState<LoginState, FormData>(managerLogin, {})

  useEffect(() => {
    if (notStaff) {
      const supabase = createClient()
      supabase.auth.signOut().catch(() => {})
    }
  }, [notStaff])

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="display text-2xl font-semibold">Manager Access</h1>
          <p className="text-on-surface-variant text-sm mt-1">Phalo Transportation — staff only</p>
        </div>

        <form action={formAction} className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
          {notStaff && (
            <p className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              This account is not authorized for the manager area.
            </p>
          )}

          <div>
            <label className="block text-xs tracking-wide text-on-surface-variant mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              placeholder="you@phalotransportation.com"
            />
          </div>

          <div>
            <label className="block text-xs tracking-wide text-on-surface-variant mb-1.5">Password</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              placeholder="••••••••"
            />
          </div>

          {state.error && (
            <p className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="gold-shimmer w-full flex items-center justify-center gap-2 font-semibold tracking-[0.1em] text-sm py-3 rounded-xl disabled:opacity-60"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {pending ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>

        <p className="text-center text-on-surface-variant/60 text-[11px] mt-6">
          Access is by invitation only. Contact an administrator if you need an account.
        </p>
      </div>
    </div>
  )
}