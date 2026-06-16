import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIpFromRequest } from '@/lib/security/rateLimit'

export const runtime = 'edge'

export async function GET(request: Request) {
  // Rate-limit: 120 keystrokes/min/IP — generous for typing, but caps scraping.
  const ip = getClientIpFromRequest(request)
  const rl = await checkRateLimit('places.autocomplete', 120, 60, ip)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ suggestions: [] })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key is missing on the server. Set GOOGLE_MAPS_API_KEY (server-only, see .env.example and HANDOFF_README.md) and redeploy.' }, { status: 500 })
  }

  try {
    // We restrict results to US, and bias heavily towards Orlando area (28.4812, -81.4)
    // with a radius of 100km (100000 meters)
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      q
    )}&components=country:us&location=28.4812,-81.4&radius=100000&key=${apiKey}`

    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API Error:', data.status, data.error_message)
      return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 })
    }

    // Map Google API format to a simpler format for our component
    interface GooglePrediction {
      description: string
      place_id: string
    }
    const suggestions = ((data.predictions || []) as GooglePrediction[]).map((p) => ({
      label: p.description,
      placeId: p.place_id,
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('API Route Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
