import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // Query information_schema to check the data type of duration_hours
  try {
    await supabase.rpc('get_reservation_by_booking', {
      p_booking_number: 'DUMMY',
      p_phone: 'DUMMY'
    })
  } catch (e) {
    // Ignore error
  }

  // Since we cannot run raw SQL directly through RPC easily without a custom function,
  // we can retrieve any single reservation and inspect the type of duration_hours,
  // or query a simple SELECT using Supabase JS.
  const { data: resData, error: resError } = await supabase
    .from('reservations')
    .select('duration_hours')
    .limit(1)

  if (resError) {
    console.error('Error fetching reservations:', resError)
    return
  }

  console.log('Database check results:')
  if (resData && resData.length > 0) {
    const val = resData[0].duration_hours
    console.log(`Type of duration_hours value in db: ${typeof val} (Value: ${val})`)
  } else {
    console.log('No reservations found to check type. We will attempt a test insert to check if decimal is supported.')
  }

  // Let's check if we can query pg_attribute or pg_class if we have a view or can find info.
  // Wait, let's try to insert a dummy reservation with a decimal duration_hours (e.g. 1.25)
  // to see if the database accepts it. This is the ultimate test of the migration!
  console.log('\nTesting a dummy reservation insert with decimal duration_hours = 1.25...')
  
  // Find a valid available vehicle first
  const { data: fleet, error: fleetError } = await supabase
    .from('fleet')
    .select('id, name')
    .eq('status', 'available')
    .limit(1)
    .single()

  if (fleetError || !fleet) {
    console.error('No available vehicle found to test booking:', fleetError?.message || 'None available')
    return
  }

  console.log(`Using vehicle: ${fleet.name} (${fleet.id})`)

  const testEmail = 'migration.test@example.com'
  
  // Delete any previous test booking
  await supabase.from('reservations').delete().eq('customer_email', testEmail)

  // Test inserting a row directly
  const { data: inserted, error: insertError } = await supabase
    .from('reservations')
    .insert({
      customer_name: 'Migration Test Chauffeur',
      customer_email: testEmail,
      customer_phone: '123-456-7890',
      pickup_address: 'MCO Airport',
      dropoff_address: 'Disney World',
      pickup_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      vehicle_id: fleet.id,
      duration_hours: 1.25, // DECIMAL DURATION!
      total_price: 150.00,
      status: 'pending',
      payment_status: 'unpaid'
    })
    .select('id, duration_hours')
    .single()

  if (insertError) {
    console.log('❌ Direct insert with decimal duration failed!')
    console.log('Error details:', insertError.message)
    console.log('This indicates the column type migration is NOT applied yet.')
  } else {
    console.log('✅ Direct insert with decimal duration succeeded!')
    console.log('Inserted details:', inserted)
    
    // Clean up
    await supabase.from('reservations').delete().eq('id', inserted.id)
  }
}

main().catch(console.error)
