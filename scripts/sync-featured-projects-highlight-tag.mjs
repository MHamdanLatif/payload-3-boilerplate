// Iteration 17 — Featured Projects gain an optional "highlight tag" that
// curates them to the top of the home-page grid (Hot Selling / Newly Launched
// / Limited Inventory).
//
// Adds:
//   1. A Postgres enum for the three tag values.
//   2. A nullable column `highlight_tag` on featured_projects of that enum.
//
// Idempotent. Safe to re-run.
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
  `DO $$ BEGIN
     CREATE TYPE "enum_featured_projects_highlight_tag" AS ENUM
       ('hot-selling', 'newly-launched', 'limited-inventory');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  `ALTER TABLE "featured_projects"
     ADD COLUMN IF NOT EXISTS "highlight_tag" "enum_featured_projects_highlight_tag";`,
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
