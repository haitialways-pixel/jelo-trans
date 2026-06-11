import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data, error } = await supabase.from('chauffeurs').select('*').limit(5)
  if (error) {
    console.error('Error fetching chauffeurs:', error.message)
  } else {
    console.log('Chauffeurs in database:', data)
  }
}

main().catch(console.error)
