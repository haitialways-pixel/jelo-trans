/**
 * Create (or reuse) a Supabase Auth user and insert the matching public.staff row.
 *
 * Usage:
 *   npm run setup-staff
 *   npm run setup-staff -- --seed-all
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
const seedAll = process.argv.includes('--seed-all')

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
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.MANAGER_EMAIL ?? 'manager@phalotransportation.com'
const password = process.env.MANAGER_PASSWORD ?? 'PhaloManager2026!'
const fullName = process.env.MANAGER_NAME ?? 'Phalo Manager'

function fail(message) {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

if (!url || !serviceKey || !anonKey) {
  fail(
    'Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or a service key\n' +
      '(SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY).\n' +
      'Copy keys from Supabase Dashboard → Project Settings → API.',
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

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(targetEmail) {
  // listUsers is broken on some Supabase projects (500). Fall back to sign-in.
  try {
    let page = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) break
      const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase())
      if (match) return match
      if (data.users.length < 200) return null
      page += 1
    }
  } catch {
    /* fall through */
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email: targetEmail,
    password,
  })
  if (!error && data.user) return data.user

  return null
}

async function ensureAuthUser(targetEmail, targetPassword) {
  let user = await findUserByEmail(targetEmail)

  if (user) {
    console.log(`Found existing auth user: ${user.email} (${user.id})`)
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: targetPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'admin' },
    })
    if (error) {
      console.warn(`Could not update password via admin API (${error.message}); continuing.`)
    } else {
      console.log('Password updated / email confirmed.')
    }
    return user
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: targetEmail,
    password: targetPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'admin' },
  })
  if (error) {
    if (error.message?.toLowerCase().includes('already')) {
      const retry = await anon.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      })
      if (retry.data?.user) {
        console.log(`Resolved existing user via sign-in: ${retry.data.user.email}`)
        return retry.data.user
      }
    }
    throw error
  }

  console.log(`Created auth user: ${data.user.email} (${data.user.id})`)
  return data.user
}

async function ensureStaffRow(user, name) {
  const { data: existingStaff, error: staffLookupError } = await admin
    .from('staff')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (staffLookupError) throw staffLookupError

  if (existingStaff) {
    console.log(`Staff row already exists (${existingStaff.role}): ${existingStaff.full_name}`)
    return
  }

  const { error: insertError } = await admin.from('staff').insert({
    id: user.id,
    full_name: name,
    role: 'admin',
  })
  if (insertError) throw insertError
  console.log(`Inserted staff row for ${name} (admin).`)
}

async function bootstrapAllStaff() {
  const { data, error } = await admin.rpc('bootstrap_staff_registry')
  if (error) {
    console.warn(
      `bootstrap_staff_registry RPC unavailable (${error.message}).\n` +
        'Run supabase/migrations/20260618_bootstrap_staff.sql in the Supabase SQL Editor, then retry.',
    )
    return 0
  }
  return data ?? 0
}

async function main() {
  await verifyHostResolvable()

  if (seedAll) {
    const inserted = await bootstrapAllStaff()
    console.log(`\n✅ Seeded ${inserted} staff row(s) from auth.users.`)
    return
  }

  const user = await ensureAuthUser(email, password)
  await ensureStaffRow(user, fullName)

  console.log('\n✅ Manager login ready:')
  console.log(`  URL:      http://localhost:3000/manager/login`)
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log('\nTip: users added in Supabase Auth get a staff row automatically (after migration 20260704).')
  console.log('     Run `npm run seed-staff` to backfill any existing auth users missing staff access.')
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
        'from the same project:\n' +
        '  • NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
        '  • SUPABASE_SERVICE_ROLE_KEY\n' +
        'Supabase Dashboard → Project Settings → API',
    )
  }
  console.error(`\n❌ ${msg}`)
  process.exit(1)
})