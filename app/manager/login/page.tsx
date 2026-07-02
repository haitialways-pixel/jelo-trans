'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (notStaff) {
      const supabase = createClient()
      supabase.auth.signOut().catch(() => {})
      setError('This account is not authorized for the manager area.')
    }
  }, [notStaff])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setLoading(false)
      setError('Invalid email or password.')
      return
    }

    // Staff check on the browser session — avoids server-action cookie race that caused infinite spin.
    const { data: profileRows, error: profileError } = await supabase.rpc('get_my_staff_profile')
    const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setLoading(false)
      setError(
        profileError?.message?.includes('get_my_staff_profile')
          ? 'Staff auth is not configured in the database. Run supabase/migrations/20260704_auto_staff_on_auth_user.sql.'
          : 'This account is not authorized for the manager area. Ask an admin to add you in Supabase Auth, or run npm run seed-staff to backfill existing users.',
      )
      return
    }

    window.location.href = '/manager'
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="display text-2xl font-semibold">Manager Access</h1>
          <p className="text-on-surface-variant text-sm mt-1">Imperial Odyssey — staff only</p>
        </div>

        <form onSubmit={onSubmit} className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs tracking-wide text-on-surface-variant mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              placeholder="you@phalotrans.com"
            />
          </div>

          <div>
            <label className="block text-xs tracking-wide text-on-surface-variant mb-1.5">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="gold-shimmer w-full flex items-center justify-center gap-2 font-semibold tracking-[0.1em] text-sm py-3 rounded-xl disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>

        <p className="text-center text-on-surface-variant/60 text-[11px] mt-6">
          Access is by invitation only. Contact an administrator if you need an account.
        </p>
      </div>
    </div>
  )
}