// One-shot: clean-slate the `media` collection in Postgres.
//
// Why: after we deleted the 42 files from R2, the DB still has 42 media rows
// pointing at filenames that no longer exist. Featured Projects, Listings and
// Blogs reference those rows for hero images, brochures, gallery, etc. Without
// cleanup, the admin shows broken thumbnails everywhere and you can't safely
// re-upload with the same filenames (Payload auto-suffixes to avoid collisions).
//
// Plan (auto-discovered, no hard-coded table list):
//   1. Query pg_constraint for every FK pointing at public.media
//   2. For each FK column:
//        a. If it's on a sub-table (array field) — DELETE the rows that
//           reference any media row. The parent collection's array shrinks
//           but its other fields are untouched.
//        b. If it's a top-level single-upload column on a parent table —
//           UPDATE ... SET column = NULL.
//   3. DELETE FROM media.
//
// Heuristic for "sub-table vs parent":
//   Payload-generated sub-tables for array fields ALWAYS have a `_parent_id`
//   column. The presence of that column is what tells us this is an array
//   row that should be deleted (not nulled).
//
// Idempotent. Re-running on an already-empty media table is a no-op.
//
// Usage:  node scripts/purge-media-db-records.mjs
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

// 1. How many media rows are we cleaning up?
const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS n FROM "media";')
const mediaCount = countRows[0].n
console.log(`media table has ${mediaCount} row(s) to delete\n`)

if (mediaCount === 0) {
  console.log('nothing to do.')
  await client.end()
  process.exit(0)
}

// 2. Discover every FK pointing at public.media
const { rows: fks } = await client.query(`
  SELECT
    (conrelid::regclass)::text AS table_name,
    a.attname               AS column_name,
    conname                  AS constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.confrelid = 'public.media'::regclass
    AND c.contype = 'f'
  ORDER BY table_name, column_name;
`)

console.log(`found ${fks.length} foreign key(s) pointing at media:`)
for (const fk of fks) {
  console.log(`  · ${fk.table_name}.${fk.column_name}`)
}
console.log()

// 3. For each FK, decide null-out vs delete-row based on whether the table
//    has a `_parent_id` column (Payload's marker for array sub-tables).
const subtableMarker = '_parent_id'
let totalNulled = 0
let totalDeleted = 0

for (const { table_name, column_name } of fks) {
  // Strip quotes if present
  const table = table_name.replace(/^"|"$/g, '')

  const { rows: cols } = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1;`,
    [table, subtableMarker],
  )
  const isSubtable = cols.length > 0

  if (isSubtable) {
    const sql = `DELETE FROM "${table}" WHERE "${column_name}" IS NOT NULL;`
    const r = await client.query(sql)
    totalDeleted += r.rowCount ?? 0
    console.log(`deleted ${r.rowCount ?? 0} row(s) from ${table} (sub-table)`)
  } else {
    const sql = `UPDATE "${table}" SET "${column_name}" = NULL WHERE "${column_name}" IS NOT NULL;`
    const r = await client.query(sql)
    totalNulled += r.rowCount ?? 0
    console.log(`nulled ${r.rowCount ?? 0} value(s) of ${table}.${column_name}`)
  }
}

// 4. Now safe to delete the media rows.
const r = await client.query('DELETE FROM "media";')
console.log(`\ndeleted ${r.rowCount ?? 0} media row(s).`)
console.log(`summary: ${totalNulled} reference(s) nulled · ${totalDeleted} sub-table row(s) deleted · ${r.rowCount ?? 0} media row(s) gone.`)

await client.end()
console.log('done.')
