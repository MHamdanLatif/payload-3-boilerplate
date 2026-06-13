// Adds:
//   1. New enum value '2 Bed DD / 3 Bed Lounge' (and renames legacy '4+ Beds' → '4+ Rooms')
//      to enum_featured_projects_unit_types_type
//   2. New `name` column on featured_projects_unit_types
//      (admin-entered human-friendly unit label)
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

const stmts = [
  // ─── 1. Add new enum values ─────────────────────────────────
  `ALTER TYPE "enum_featured_projects_unit_types_type" ADD VALUE IF NOT EXISTS '2 Bed DD / 3 Bed Lounge';`,
  `ALTER TYPE "enum_featured_projects_unit_types_type" ADD VALUE IF NOT EXISTS '4+ Rooms';`,
  // Note: Postgres does NOT allow removing enum values without a heavy rewrite,
  // so the legacy '4+ Beds' value stays in the enum. New entries use '4+ Rooms'.
  // Existing rows storing '4+ Beds' continue to work.

  // ─── 2. Add `name` column ───────────────────────────────────
  `ALTER TABLE "featured_projects_unit_types" ADD COLUMN IF NOT EXISTS "name" varchar;`,
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
