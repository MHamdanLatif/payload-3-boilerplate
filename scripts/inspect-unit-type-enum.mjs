// Diagnostic: dump current enum values and any rows in array tables that hold them.
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

const colInfo = await client.query(`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_name = 'featured_projects_unit_types';
`)
console.log('--- featured_projects_unit_types columns ---')
colInfo.rows.forEach((r) => console.log(` · ${r.column_name}: ${r.data_type} (${r.udt_name})`))

const enumRows = await client.query(`
  SELECT t.typname, e.enumlabel
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typname LIKE 'enum_featured_projects_unit_types_type'
  ORDER BY t.typname, e.enumsortorder;
`)
console.log('--- enum_featured_projects_unit_types_type values ---')
enumRows.rows.forEach((r) => console.log(' ·', r.enumlabel))

const dataRows = await client.query(`
  SELECT id, type FROM featured_projects_unit_types ORDER BY id;
`)
console.log('--- featured_projects_unit_types rows ---')
if (dataRows.rows.length === 0) {
  console.log(' (empty table)')
} else {
  dataRows.rows.forEach((r) => console.log(` · id=${r.id} type=${r.type}`))
}

await client.end()
