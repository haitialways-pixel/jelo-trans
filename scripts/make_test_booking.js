import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const pickup = 'Orlando International Airport (MCO), Jeff Fuqua Boulevard, Orlando, FL'
  const dropoff = 'Walt Disney World Resort, Orlando, FL'

  console.log(`📍 Origin: ${pickup}`)
  console.log(`📍 Destination: ${dropoff}`)

  // 1. Fetch distance and duration from Google Maps API
  console.log('\n1. Fetching distance and duration from our server API...')
  const apiHost = process.env.SITE_URL || 'http://localhost:3000'
  
  let durationMins = 32 // fallback default if API fails
  let distanceMiles = 19.5
  let durationText = '32 mins'
  let distanceText = '19.5 mi'

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        pickup
      )}&destinations=${encodeURIComponent(dropoff)}&key=${apiKey}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.status === 'OK') {
        const row = data.rows?.[0]
        const element = row?.elements?.[0]
        if (element && element.status === 'OK') {
          durationMins = Math.ceil(element.duration.value / 60)
          distanceMiles = Math.round((element.distance.value * 0.000621371) * 10) / 10
          durationText = element.duration.text
          distanceText = element.distance.text
          console.log(`✅ Google Maps returned: ${durationText} (${distanceText})`)
        }
      }
    } catch (err) {
      console.warn('Could not contact Google Maps directly, using default mock details:', err.message)
    }
  }

  // 2. Apply pricing logic (Base Price + Rate Per Mile)
  console.log('\n2. Applying pricing logic (Base Price + Rate Per Mile)...')
  let billingHours = 1.0
  if (durationMins > 60) {
    billingHours = durationMins / 60.0
  }

  console.log(`- Travel Time: ${durationMins} minutes (${durationText})`)
  console.log(`- Duration reserved: ${billingHours.toFixed(2)} hours`)

  // 3. Find an available vehicle
  const { data: vehicle, error: fleetError } = await supabase
    .from('fleet')
    .select('id, name, base_price, price_per_mile')
    .eq('status', 'available')
    .limit(1)
    .single()

  if (fleetError || !vehicle) {
    console.error('❌ No available vehicle found in catalog:', fleetError?.message || 'Empty fleet')
    return
  }

  const basePrice = Number(vehicle.base_price)
  const mileRate = Number(vehicle.price_per_mile)
  const rawSubtotal = Math.round((basePrice + distanceMiles * mileRate) * 100) / 100
  const totalWithGratuity = Math.round(rawSubtotal * 1.20 * 100) / 100
  
  console.log(`- Vehicle chosen: ${vehicle.name}`)
  console.log(`- Base Price: $${basePrice}`)
  console.log(`- Mile Rate: $${mileRate}/mile`)
  console.log(`- Price calculated: $${rawSubtotal} subtotal + 20% gratuity = $${totalWithGratuity} total`)

  // 4. Create the reservation in live database
  console.log('\n3. Creating the reservation via Supabase RPC (simulating client submit)...')
  
  const testEmail = 'live.test.booking@example.com'
  
  // Clean up old runs
  await supabase.from('reservations').delete().eq('customer_email', testEmail)

  const pickupTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString() // 2 days in future

  const { data: bookingNumber, error: bookingError } = await supabase.rpc('create_reservation', {
    p_customer_name: 'Jean-Marc Test',
    p_customer_email: testEmail,
    p_customer_phone: '(407) 555-9999',
    p_pickup_address: pickup,
    p_dropoff_address: dropoff,
    p_pickup_time: pickupTime,
    p_vehicle_id: vehicle.id,
    p_passengers: 3,
    p_luggage: 3,
    p_duration_hours: billingHours,
    p_special_requests: 'Live test of Distance and Base Price billing.',
    p_distance_miles: distanceMiles
  })

  if (bookingError) {
    console.error('❌ Reservation creation failed!')
    console.error('Error message:', bookingError.message)
    console.error('\nNOTE: If the error mentions invalid type integer or parameters, you must apply the SQL migration in your Supabase Editor first!')
    return
  }

  console.log(`✅ Reservation successfully created!`)
  console.log(`- Booking Number: ${bookingNumber}`)

  // 5. Retrieve the reservation to view details
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('id, duration_hours, total_price, status')
    .eq('booking_number', bookingNumber)
    .single()

  if (fetchError || !reservation) {
    console.error('❌ Failed to fetch the created reservation:', fetchError?.message)
    return
  }

  console.log('\nCreated reservation details in database:')
  console.log(JSON.stringify(reservation, null, 2))

  // 6. Confirm the reservation (simulating admin area action)
  console.log('\n4. Confirming the booking on the Admin side...')
  
  const { data: confirmedReservation, error: updateError } = await supabase
    .from('reservations')
    .update({
      status: 'confirmed'
    })
    .eq('id', reservation.id)
    .select('id, booking_number, status, total_price')
    .single()

  if (updateError) {
    console.error('❌ Failed to confirm reservation as admin:', updateError.message)
    return
  }

  console.log(`✅ Admin confirmation successful!`)
  console.log(`Final booking details:`)
  console.log(JSON.stringify(confirmedReservation, null, 2))
}

main().catch(console.error)
