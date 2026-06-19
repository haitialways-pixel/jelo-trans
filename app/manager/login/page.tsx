'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ManagerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/manager/login')
        return
      }
      setUser(data.user)
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return <div className="p-8 text-center">Loading manager portal...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Manager Portal</h1>
      
      <div className="bg-white/5 p-8 rounded-2xl">
        <p>Welcome, {user?.email}</p>
        <p className="text-green-400 mt-2">You are logged in as Manager</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        <div className="bg-white/5 p-6 rounded-2xl">
          <h3 className="font-semibold mb-4">Fleet Management</h3>
          <p>Manage vehicles and drivers</p>
        </div>
        <div className="bg-white/5 p-6 rounded-2xl">
          <h3 className="font-semibold mb-4">Reservations</h3>
          <p>View and assign bookings</p>
        </div>
      </div>
    </div>
  )
}