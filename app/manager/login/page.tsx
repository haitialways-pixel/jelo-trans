'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ManagerDashboard() {
  const [status, setStatus] = useState('Checking login...')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data, error }) => {
      console.log("Session check:", { session: data.session, error })
      
      if (error || !data.session) {
        setStatus('No session found. Redirecting to login...')
        router.push('/manager/login')
        return
      }

      const role = data.session.user?.user_metadata?.role
      if (role !== 'manager') {
        setStatus('Not authorized as manager. Signing out...')
        supabase.auth.signOut()
        router.push('/manager/login?error=not_staff')
        return
      }

      setStatus('✅ Manager access granted!')
    })
  }, [router])

  return (
    <div className="p-12 text-center">
      <div className="text-2xl mb-4">{status}</div>
      <p className="text-sm text-gray-400">Check the browser console for more details (F12)</p>
    </div>
  )
}