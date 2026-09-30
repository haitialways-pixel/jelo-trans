/**
 * Apply supabase/migrations/20260930_company_vehicle_units.sql
 * (columns + 13 company cars). Does not run schema.sql.
 *
 * Needs SUPABASE_DB_URL or DATABASE_URL (Dashboard → Connect → URI).
 */
const { readFileSync, existsSync } = require('fs')
const { resolve, dirname } = require('path')
const { Client } = require('pg')

const root = resolve(dirname(__dirname))
const migrationPath = resolve(root, 'supabase/migrations/20260930_company_vehicle_units.sql')

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
loadEnvFile('.dev.vars')

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

async function main() {
  if (!dbUrl) {
    console.error(
      'Missing SUPABASE_DB_URL / DATABASE_URL. Paste this file in Supabase SQL Editor:\n' +
        migrationPath,
    )
    process.exit(1)
  }

  const sql = readFileSync(migrationPath, 'utf8')
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    const units = await client.query(`
      SELECT year, make, model_name, vin, license_plate, registration_expires, status, label,
             (SELECT name FROM public.fleet f WHERE f.id = u.model_id) AS class_name
      FROM public.vehicle_units u
      WHERE upper(btrim(license_plate)) IN (
        'FK12U','11ALJC','39EJGV','DI11NC','03EZTL','33DFRY','CT81DF',
        'BN11SR','RJSC34','LUCJ04','LEKR82','30VCBK','XKG282'
      )
      ORDER BY year, make, model_name, license_plate
    `)
    console.log(`company vehicles: ${units.rowCount} row(s)`)
    for (const row of units.rows) {
      console.log(
        `${row.label}  class=${row.class_name}  vin=${row.vin}  exp=${row.registration_expires}  ${row.status}`,
      )
    }
    const sedan = await client.query(`
      SELECT count(*)::int AS n
      FROM public.vehicle_units u
      JOIN public.fleet f ON f.id = u.model_id
      WHERE f.name = 'Luxury Sedan'
        AND upper(btrim(u.license_plate)) IN (
          'FK12U','11ALJC','39EJGV','DI11NC','03EZTL','33DFRY','CT81DF',
          'BN11SR','RJSC34','LUCJ04','LEKR82','30VCBK','XKG282'
        )
    `)
    console.log(`attached to Luxury Sedan: ${sedan.rows[0].n}`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
