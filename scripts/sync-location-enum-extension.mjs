// Extend the shared LOCATION_OPTIONS enum with Clifton, Model Colony, Malir.
// Jinnah Avenue was already present; the other three are new.
// Postgres has separate enums per collection (enum_featured_projects_location,
// enum_property_listings_location) so we ADD VALUE IF NOT EXISTS on both.
// Idempotent — safe to re-run.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=')
    if (i === -1) return acc
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    acc[k] = v
    return acc
  }, {})

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })

const NEW_VALUES = ['Clifton', 'Model Colony', 'Malir']
const ENUMS = ['enum_featured_projects_location', 'enum_property_listings_location']

await client.connect()
for (const enumName of ENUMS) {
  for (const value of NEW_VALUES) {
    try {
      await client.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`)
      console.log(`ok: ${enumName} += '${value}'`)
    } catch (e) {
      console.warn(`skip ${enumName} += '${value}':`, e.message.slice(0, 200))
    }
  }
}
await client.end()
console.log('done.')
