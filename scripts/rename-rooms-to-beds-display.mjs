// One-shot: rename the unit-type ENUM VALUES from "X Room Lounge" back to "X Bed Lounge"
// and migrate any text rows that still hold "Room" labels. Idempotent.
// The `rooms` numeric column on featured_projects_unit_types and property_listings
// keeps its name (it stores the bedroom count); only display labels change in code.
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1)
    acc[k] = v
    return acc
  }, {})

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })

const enumRenames = [
  ['1 Room Lounge', '1 Bed Lounge'],
  ['2 Room Lounge', '2 Bed Lounge'],
  ['2 Room Drawing', '2 Bed Drawing'],
  ['3 Room Lounge', '3 Bed Lounge'],
  ['3 Room Drawing', '3 Bed Drawing'],
  ['4 Room Drawing', '4 Bed Drawing'],
  ['4+ Rooms', '4+ Beds'],
]

const stmts = [
  // Rename enum values via ALTER TYPE
  ...enumRenames.map(
    ([from, to]) => `DO $$ BEGIN
      ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '${from}' TO '${to}';
    EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
  ),

  // Migrate any text rows that still hold "Room" labels (column is text not enum,
  // so ALTER TYPE alone doesn't rewrite the data).
  ...enumRenames.map(
    ([from, to]) =>
      `UPDATE "featured_projects_unit_types" SET "type" = '${to}' WHERE "type" = '${from}';`,
  ),
]

await client.connect()
for (const s of stmts) {
  try {
    const res = await client.query(s)
    const note = res.rowCount != null ? ` (${res.rowCount} row${res.rowCount === 1 ? '' : 's'})` : ''
    console.log('ok' + note)
  } catch (e) {
    console.warn('skip:', e.message.slice(0, 140))
  }
}
await client.end()
console.log('done.')
