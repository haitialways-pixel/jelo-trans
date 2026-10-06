'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env'
import { Lock, Loader2 } from 'lucide-react'

function createSetPasswordClient() {
  return createBrowserClient(getSupabaseUrl()!, getSupabasePublicKey()!, {
    isSingleton: false,
    auth: { detectSessionInUrl: false },
  })
}

type Phase = 'working' | 'form' | 'done' | 'error'

function readAuthParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const pick = (key: string) => hash.get(key) || query.get(key)
  return {
    type: pick('type'),
    accessToken: pick('access_token'),
    refreshToken: pick('refresh_token'),
    tokenHash: pick('token_hash'),
    code: pick('code'),
    errorDescription: pick('error_description') || pick('error'),
  }
}

function clearAuthParams() {
  const url = new URL(window.location.href)
  url.hash = ''
  for (const key of ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'code', 'token_hash', 'error', 'error_code', 'error_description']) {
    url.searchParams.delete(key)
  }
  const search = url.searchParams.toString()
  window.history.replaceState(window.history.state, '', url.pathname + (search ? `?${search}` : ''))
}

function isEmailOtpType(type: string | null): type is EmailOtpType {
  return type === 'invite' || type === 'recovery' || type === 'signup' || type === 'email' || type === 'magiclink'
}

export default function SetPasswordPage() {
  const clientRef = useRef<SupabaseClient | null>(null)
  const [phase, setPhase] = useState<Phase>('working')
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createSetPasswordClient()
    clientRef.current = supabase

    async function establish() {
      const params = readAuthParams()
      const fail = (message: string) => {
        if (cancelled) return
        clearAuthParams()
        setError(message)
        setPhase('error')
      }

      if (params.errorDescription && !params.accessToken && !params.tokenHash && !params.code) {
        fail(params.errorDescription.replace(/\+/g, ' '))
        return
      }

      if (params.accessToken && params.refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        })
        if (sessionError || !data.session) {
          fail(sessionError?.message || 'This invitation link is invalid or has expired.')
          return
        }
      } else if (params.tokenHash && (params.type === 'invite' || params.type === 'recovery') && isEmailOtpType(params.type)) {
        const { data, error: otpError } = await supabase.auth.verifyOtp({
          token_hash: params.tokenHash,
          type: params.type,
        })
        if (otpError || !data.session) {
          fail(otpError?.message || 'This invitation link is invalid or has expired.')
          return
        }
      } else if (params.code) {
        const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(params.code)
        if (codeError || !data.session) {
          fail(codeError?.message || 'This invitation link could not be opened in this browser. Ask an admin to send a new invite.')
          return
        }
      } else {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          fail('Open the link in the invitation email (subject "You\'ve been invited"). This page cannot create a password without that link.')
          return
        }
      }

      if (cancelled) return
      clearAuthParams()
      setPhase('form')
    }

    establish().catch(() => {
      if (!cancelled) {
        setError('Could not open this invitation link.')
        setPhase('error')
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }
    const supabase = clientRef.current
    if (!supabase) {
      setError('Session expired. Open the invitation link again.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setPhase('done')
    window.location.href = '/manager'
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="accent-line mx-auto mb-8" />
          <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-card flex items-center justify-center shadow-[0_12px_40px_-12px_rgba(24,5,219,0.12)]">
            <Lock className="w-5 h-5 text-gold" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl font-medium">Create your password</h1>
          <p className="text-on-surface-variant text-sm mt-3">Imperial Odyssey - staff only</p>
        </div>

        {phase === 'working' || phase === 'done' ? (
          <p className="text-center text-on-surface-variant text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {phase === 'done' ? 'Password saved. Signing you in...' : 'Checking your invitation...'}
          </p>
        ) : null}

        {phase === 'form' ? (
          <form onSubmit={onSubmit} className="float-card p-8 space-y-5">
            <div>
              <label className="block text-xs tracking-wide text-on-surface-variant mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wide text-on-surface-variant mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            {error ? (
              <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="btn-cta w-full flex items-center justify-center gap-2 text-sm py-3.5 rounded-full disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'SAVING...' : 'CREATE PASSWORD'}
            </button>
          </form>
        ) : null}

        {phase === 'error' ? (
          <div className="float-card p-8 space-y-4">
            <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            <a href="/manager/login" className="btn-cta w-full flex items-center justify-center text-sm py-3.5 rounded-full">
              BACK TO SIGN IN
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}