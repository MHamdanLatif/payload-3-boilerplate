// Companion to rename-jauhar-to-johar.mjs — handles the enum-typed `location`
// columns that the generic text-column sweep skips (data_type comes back as
// USER-DEFINED for enum columns). Auto-discovers any column whose data_type
// is USER-DEFINED in public schema and updates rows matching the old spelling.
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    acc[k] = v
    return acc
  }, {})

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })
await client.connect()

// Make sure the enum accepts the new value before we UPDATE into it.
await client
  .query(
    `DO $$ BEGIN
       ALTER TYPE "enum_featured_projects_location" ADD VALUE IF NOT EXISTS 'Gulistan-e-Johar';
     EXCEPTION WHEN undefined_object THEN NULL; END $$;`,
  )
  .catch((e) => console.warn(`enum extend: ${e.message.slice(0, 120)}`))

// Postgres requires a commit between ADD VALUE and using the new value.
// Reconnect to force the new enum value to be visible to subsequent queries.
await client.end()
const c2 = new pg.Client({ connectionString: env.DATABASE_URI })
await c2.connect()

const { rows: enumCols } = await c2.query(`
  SELECT table_name, column_name
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND data_type = 'USER-DEFINED'
   ORDER BY table_name, column_name;
`)

let total = 0
for (const { table_name, column_name } of enumCols) {
  try {
    const r = await c2.query(
      `UPDATE "${table_name}"
          SET "${column_name}" = 'Gulistan-e-Johar'
        WHERE "${column_name}"::text = 'Gulistan-e-Jauhar';`,
    )
    if ((r.rowCount ?? 0) > 0) {
      console.log(`  ✓ ${table_name}.${column_name}: ${r.rowCount} row(s)`)
      total += r.rowCount
    }
  } catch (e) {
    // Most enum columns don't take a Gulistan-e-Johar value (status, etc.) —
    // the UPDATE compiles but the WHERE never matches. Errors are only thrown
    // when the right-hand value doesn't belong to the column's enum; in that
    // case we silently skip — no row matched anyway.
    if (!/invalid input value for enum/i.test(e.message)) {
      console.warn(`  ✗ ${table_name}.${column_name}: ${e.message.slice(0, 100)}`)
    }
  }
}

console.log(`\nsummary: ${total} enum row(s) updated.`)
await c2.end()
console.log('done.')
