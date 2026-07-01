/**
 * Apply auto-staff auth migration and backfill existing users.
 *
 * With SUPABASE_DB_URL — runs the full SQL migration (trigger + backfill).
 * With API keys only — backfills via bootstrap_staff_registry RPC (trigger must
 *   already be applied, or paste the migration in Supabase SQL Editor once).
 */
const { readFileSync, existsSync } = require('fs')
const { resolve, dirname } = require('path')
const { createClient } = require('@supabase/supabase-js')
const { Client } = require('pg')

const root = resolve(dirname(__dirname))
const migrationPath = resolve(root, 'supabase/migrations/20260704_auto_staff_on_auth_user.sql')

function loadEnvFile(filename) {
  const path = resolve(root, filename)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

async function backfillViaRpc() {
  if (!url || !serviceKey) {
    console.error(
      'Missing API keys. Need NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.',
    )
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.rpc('bootstrap_staff_registry')
  if (error) {
    if (
      error.message?.includes('bootstrap_staff_registry') ||
      error.code === 'PGRST202'
    ) {
      console.error(
        'bootstrap_staff_registry is not installed yet — run the migration SQL in Supabase SQL Editor first.\n',
      )
      console.log(readFileSync(migrationPath, 'utf8'))
      process.exit(1)
    }
    throw error
  }
  console.log(`✅ Backfilled ${data ?? 0} staff row(s) via bootstrap_staff_registry.`)
  console.log(
    '\nIf you have not run the migration yet, paste supabase/migrations/20260704_auto_staff_on_auth_user.sql\n' +
      'in Supabase SQL Editor so new Auth users are auto-provisioned.',
  )
}

async function applyViaPg() {
  const sql = readFileSync(migrationPath, 'utf8')
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    console.log('✅ Applied 20260704_auto_staff_on_auth_user.sql')
    const { rows } = await client.query('SELECT public.bootstrap_staff_registry() AS inserted')
    console.log(`✅ Backfilled ${rows[0]?.inserted ?? 0} staff row(s) for existing auth users.`)
    console.log('\nNew users added in Supabase Auth will get manager access automatically.')
  } finally {
    await client.end()
  }
}

async function main() {
  if (!existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath)
    process.exit(1)
  }

  if (dbUrl) {
    await applyViaPg()
    return
  }

  if (url && serviceKey) {
    console.log('No SUPABASE_DB_URL — using API keys to backfill existing users.\n')
    await backfillViaRpc()
    return
  }

  console.log(
    'No SUPABASE_DB_URL or API keys found. Paste this in Supabase Dashboard → SQL Editor:\n',
  )
  console.log(readFileSync(migrationPath, 'utf8'))
}

main().catch((err) => {
  console.error('\n❌', err.message)
  process.exit(1)
})