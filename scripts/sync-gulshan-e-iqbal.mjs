// Adds 'Gulshan-e-Iqbal' to the location enums on both FeaturedProjects
// and PropertyListings (the original enum just had the short form 'Gulshan').
// Idempotent. Note: Postgres can't drop the legacy 'Gulshan' value without a
// heavy rewrite, so it stays in the enum unused. New entries use 'Gulshan-e-Iqbal'.
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

const stmts = [
  `ALTER TYPE "enum_featured_projects_location" ADD VALUE IF NOT EXISTS 'Gulshan-e-Iqbal';`,
  `ALTER TYPE "enum_property_listings_location" ADD VALUE IF NOT EXISTS 'Gulshan-e-Iqbal';`,
]

await client.connect()
for (const s of stmts) {
  try {
    await client.query(s)
    console.log('ok')
  } catch (e) {
    console.warn('skip:', e.message.slice(0, 200))
  }
}
await client.end()
console.log('done.')
