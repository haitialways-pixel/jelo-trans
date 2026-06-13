import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIpFromRequest } from '@/lib/security/rateLimit'

export const runtime = 'edge'

export async function GET(request: Request) {
  // Rate-limit: 60 lookups/min/IP. Protects the Google Distance Matrix quota
  // from being scraped via our endpoint (which would inflate the bill).
  const ip = getClientIpFromRequest(request)
  const rl = await checkRateLimit('places.distance', 60, 60, ip)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many distance lookups. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const { searchParams } = new URL(request.url)
  const pickup = searchParams.get('pickup')
  const dropoff = searchParams.get('dropoff')

  if (!pickup || !dropoff) {
    return NextResponse.json(
      { error: 'Pickup and dropoff addresses are required' },
      { status: 400 }
    )
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps API key is missing on the server' },
      { status: 500 }
    )
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      pickup
    )}&destinations=${encodeURIComponent(dropoff)}&units=imperial&key=${apiKey}`

    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('Google Distance Matrix API Error Status:', data.status, data.error_message)
      return NextResponse.json(
        { error: `Google API Error: ${data.status}` },
        { status: 500 }
      )
    }

    const row = data.rows?.[0]
    const element = row?.elements?.[0]

    if (!element || element.status !== 'OK') {
      const errorMsg = element?.status || 'UNKNOWN_ELEMENT_STATUS'
      console.error('Google Distance Matrix Element Error:', errorMsg)
      return NextResponse.json(
        { error: `Could not calculate distance (Status: ${errorMsg})` },
        { status: 400 }
      )
    }

    const durationSeconds = element.duration.value
    const distanceMeters = element.distance.value
    
    // Convert meters to miles (1 meter = 0.000621371 miles)
    const distanceMiles = Math.round((distanceMeters * 0.000621371) * 10) / 10
    const durationMinutes = Math.ceil(durationSeconds / 60)

    return NextResponse.json({
      originAddress: data.origin_addresses?.[0] || pickup,
      destinationAddress: data.destination_addresses?.[0] || dropoff,
      distanceMiles,
      durationMinutes,
      durationText: element.duration.text,
      distanceText: element.distance.text,
    })
  } catch (error) {
    console.error('Distance Matrix API Route Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
