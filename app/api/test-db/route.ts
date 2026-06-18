// app/api/test-db/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Test simple query
    const { data, error } = await supabase
      .from('vehicles')           // Change to a table you have
      .select('count')
      .limit(1)

    if (error) throw error

    return NextResponse.json({
      status: '✅ Supabase connected successfully!',
      rowCount: data?.length || 0,
      message: 'Database is reachable'
    })
  } catch (err: any) {
    console.error('DB Test Error:', err)
    return NextResponse.json({
      status: '❌ Failed',
      error: err.message
    }, { status: 500 })
  }
}