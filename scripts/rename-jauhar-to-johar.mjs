// One-shot: rename "Jauhar" → "Johar" everywhere in the database.
//
// Why: SEO research showed buyers search "Gulistan-e-Johar", not "Jauhar".
// The location entity slug and canonical name changed in code; this script
// catches the matching DB content so every already-published blog, project
// description, listing, page block, SEO internal-link row — anything stored
// in the database — lines up with the new spelling.
//
// Approach (auto-discovered, no hard-coded table list):
//   1. ALTER each Postgres enum that gates a `location` select field so it
//      accepts the new spelling alongside the old. Avoids "invalid input
//      value for enum" failures during the UPDATE pass.
//   2. Discover every text / varchar column in public schema. For each one
//      that has a row containing 'jauhar' (case-insensitive), UPDATE the
//      matching rows with REPLACE for both casings.
//   3. Discover every jsonb column in public schema (Lexical content,
//      meta blocks, etc.). Cast to text, run REPLACE for both casings AND
//      the slug variants ('gulistan-e-jauhar' → 'gulistan-e-johar' fixes
//      link URLs inside blog content), cast back.
//   4. SEO internal-link sub-table — special-case the `target_location_slug`
//      column since it's an exact-match identifier, not free text.
//
// Idempotent. Safe to re-run — every UPDATE is gated by a WHERE that only
// touches rows that still contain the old spelling.
//
// Usage:  node scripts/rename-jauhar-to-johar.mjs
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

let totalRows = 0
async function run(label, sql) {
  try {
    const r = await client.query(sql)
    const n = r.rowCount ?? 0
    if (n > 0) {
      totalRows += n
      console.log(`  ✓ ${label}: ${n} row(s)`)
    }
  } catch (e) {
    // Skip system/internal columns that can't be UPDATEd (generated columns,
    // views, etc.) — log so we know what we missed.
    console.warn(`  ✗ ${label}: SKIP — ${e.message.slice(0, 120)}`)
  }
}

console.log('─── 1. Extend Postgres enums to accept the new spelling ─────────')
// Auto-discover every enum whose label set contains 'Gulistan-e-Jauhar' and
// add the new variant. Catches both featured_projects + property_listings
// (and anything else Payload generates that gates a location select).
const { rows: locationEnums } = await client.query(`
  SELECT DISTINCT t.typname
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE e.enumlabel = 'Gulistan-e-Jauhar';
`)
for (const { typname } of locationEnums) {
  await run(
    `${typname} += 'Gulistan-e-Johar'`,
    `DO $$ BEGIN
       ALTER TYPE "${typname}" ADD VALUE IF NOT EXISTS 'Gulistan-e-Johar';
     EXCEPTION WHEN undefined_object THEN NULL; END $$;`,
  )
}

console.log('\n─── 2. Plain-text columns (text / varchar) ──────────────────────')
const { rows: textCols } = await client.query(`
  SELECT table_name, column_name
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND data_type IN ('text', 'character varying', 'character')
   ORDER BY table_name, column_name;
`)
for (const { table_name, column_name } of textCols) {
  await run(
    `${table_name}.${column_name}`,
    `UPDATE "${table_name}"
        SET "${column_name}" = REPLACE(REPLACE("${column_name}", 'Jauhar', 'Johar'), 'jauhar', 'johar')
      WHERE "${column_name}" ~* 'jauhar';`,
  )
}

console.log('\n─── 3. JSON / Lexical columns (jsonb) ───────────────────────────')
// Lexical jsonb holds visible text AND link URLs in the same blob, so the
// 4-stage REPLACE catches both the spelling and the slug used by internal
// link nodes (/locations/gulistan-e-jauhar → -johar).
const { rows: jsonbCols } = await client.query(`
  SELECT table_name, column_name
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND data_type = 'jsonb'
   ORDER BY table_name, column_name;
`)
for (const { table_name, column_name } of jsonbCols) {
  await run(
    `${table_name}.${column_name}`,
    `UPDATE "${table_name}"
        SET "${column_name}" = REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE("${column_name}"::text, 'Jauhar', 'Johar'),
                  'jauhar', 'johar'),
                'gulistan-e-jauhar', 'gulistan-e-johar'),
              'Gulistan-e-Jauhar', 'Gulistan-e-Johar')::jsonb
      WHERE "${column_name}"::text ~* 'jauhar';`,
  )
}

console.log('\n─── 4. SEO internal-link target slug (exact match) ─────────────')
await run(
  `blogs_seo_internal_links.target_location_slug`,
  `UPDATE "blogs_seo_internal_links"
      SET "target_location_slug" = 'gulistan-e-johar'
    WHERE "target_location_slug" = 'gulistan-e-jauhar';`,
)

console.log(`\nsummary: ${totalRows} total row(s) touched.`)
await client.end()
console.log('done.')
