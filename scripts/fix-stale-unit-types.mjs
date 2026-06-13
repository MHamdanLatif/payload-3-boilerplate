// Fix legacy "Bed" unit type strings that slipped past the enum rename
// because the column was created as `text` rather than the enum.
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
await client.connect()

const mappings = [
  ['1 Bed Lounge', '1 Room Lounge'],
  ['2 Bed Lounge', '2 Room Lounge'],
  ['2 Bed Drawing', '2 Room Drawing'],
  ['3 Bed Lounge', '3 Room Lounge'],
  ['3 Bed Drawing', '3 Room Drawing'],
  ['4 Bed Drawing', '4 Room Drawing'],
  ['4+ Beds', '4+ Rooms'],
]

for (const [oldV, newV] of mappings) {
  const r = await client.query(
    'UPDATE featured_projects_unit_types SET type = $1 WHERE type = $2',
    [newV, oldV],
  )
  if (r.rowCount) console.log(`updated ${r.rowCount}× ${oldV} → ${newV}`)
}

await client.end()
console.log('done.')
