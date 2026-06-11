import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data, error } = await supabase
    .from('fleet')
    .select('*')
  
  if (error) {
    console.error('Error fetching fleet rows:', error.message)
    return
  }
  
  console.log('Total rows in fleet:', data.length)
  console.log('Rows:', data)
}

main().catch(console.error)
