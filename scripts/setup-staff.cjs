/**
 * Create (or reuse) a Supabase Auth user and insert the matching public.staff row.
 *
 * Usage:
 *   npm run setup-staff
 *
 * Optional env overrides:
 *   MANAGER_EMAIL=manager@phalotransportation.com
 *   MANAGER_PASSWORD=YourSecurePassword123!
 *   MANAGER_NAME="Phalo Manager"
 */
const { createClient } = require('@supabase/supabase-js')
const { readFileSync, existsSync } = require('fs')
const { resolve, dirname } = require('path')
const { URL } = require('url')

const root = resolve(__dirname, '..')

function loadEnvFile(filename) {
  const path = resolve(root, filename)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.MANAGER_EMAIL ?? 'manager@phalotransportation.com'
const password = process.env.MANAGER_PASSWORD ?? 'PhaloManager2026!'
const fullName = process.env.MANAGER_NAME ?? 'Phalo Manager'

function fail(message) {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

if (!url || !serviceKey) {
  fail(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Copy .env.example → .env.local and paste your keys from\n' +
      'Supabase Dashboard → Project Settings → API.',
  )
}

if (url.includes('YOUR_PROJECT_REF') || url.includes('your-project')) {
  fail(
    'NEXT_PUBLIC_SUPABASE_URL in .env.local is still a placeholder.\n' +
      'Open Supabase Dashboard → Project Settings → API and copy your Project URL.',
  )
}

let hostname
try {
  hostname = new URL(url).hostname
} catch {
  fail(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${url}`)
}

async function verifyHostResolvable() {
  const dns = require('dns').promises
  try {
    await dns.lookup(hostname)
  } catch {
    fail(
      `Cannot resolve Supabase host "${hostname}".\n` +
        'The project may not exist or the URL in .env.local is wrong.\n' +
        'Use the exact Project URL from Supabase Dashboard → Project Settings → API.',
    )
  }
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(targetEmail) {
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase())
    if (match) return match
    if (data.users.length < 200) break
    page += 1
  }
  return null
}

async function main() {
  await verifyHostResolvable()

  let user = await findUserByEmail(email)

  if (user) {
    console.log(`Found existing auth user: ${user.email} (${user.id})`)
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    })
    if (error) throw error
    console.log('Password updated / email confirmed.')
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw error
    user = data.user
    console.log(`Created auth user: ${user.email} (${user.id})`)
  }

  const { data: existingStaff, error: staffLookupError } = await admin
    .from('staff')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (staffLookupError) throw staffLookupError

  if (existingStaff) {
    console.log(`Staff row already exists (${existingStaff.role}): ${existingStaff.full_name}`)
  } else {
    const { error: insertError } = await admin.from('staff').insert({
      id: user.id,
      full_name: fullName,
      role: 'admin',
    })
    if (insertError) throw insertError
    console.log(`Inserted staff row for ${fullName} (admin).`)
  }

  console.log('\n✅ Manager login ready:')
  console.log(`  URL:      http://localhost:3000/manager/login`)
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
}

main().catch((err) => {
  const msg = err?.message ?? String(err)
  if (msg.includes('fetch failed') || msg.includes('ENOTFOUND')) {
    fail(
      `Could not reach Supabase at ${hostname}.\n` +
        'Check NEXT_PUBLIC_SUPABASE_URL in .env.local matches your live project.',
    )
  }
  if (msg.includes('Invalid API key') || msg.includes('invalid JWT')) {
    fail(
      'Supabase rejected the service role key.\n' +
        'After changing the project URL, you must also update BOTH keys in .env.local\n' +
        'from the same project (eeytcoibulhxuxlsrjhe):\n' +
        '  • NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
        '  • SUPABASE_SERVICE_ROLE_KEY\n' +
        'Supabase Dashboard → Project Settings → API',
    )
  }
  console.error(`\n❌ ${msg}`)
  process.exit(1)
})