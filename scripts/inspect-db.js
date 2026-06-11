import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data: fleetData, error: fleetError } = await supabase
    .from('fleet')
    .select('*')
    .limit(1)
  
  if (fleetError) {
    console.error('Error fetching fleet:', fleetError.message)
  } else {
    console.log('Columns in fleet table:', Object.keys(fleetData[0] || {}))
  }

  const { data: resData, error: resError } = await supabase
    .from('reservations')
    .select('*')
    .limit(1)

  if (resError) {
    console.error('Error fetching reservations:', resError.message)
  } else {
    console.log('Columns in reservations table:', Object.keys(resData[0] || {}))
  }
}

main().catch(console.error)

