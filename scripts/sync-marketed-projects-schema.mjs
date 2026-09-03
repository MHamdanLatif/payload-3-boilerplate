// Applies the `marketed-projects` schema to whichever database `.env` points at.
//
// Railway runs no migrations, so production DDL goes on by hand before the code
// deploy. The statements themselves live in
// `src/migrations/sql/marketedProjects.ts` and are shared with the committed
// migration, so this script and the migration can never drift.
//
// Idempotent — safe to re-run. Run with: npx tsx scripts/sync-marketed-projects-schema.mjs
import { readFileSync } from 'node:fs'
import pg from 'pg'

import {
  MARKETED_PROJECTS_DDL,
  MARKETED_PROJECTS_ENUM_DDL,
} from '../src/migrations/sql/marketedProjects.ts'

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

const client = new pg.Client({ connectionString: env.DATABASE_URI })

async function main() {
  await client.connect()
  try {
    await client.query('BEGIN')
    for (const s of MARKETED_PROJECTS_DDL) await client.query(s)
    await client.query('COMMIT')
    console.log(`applied ${MARKETED_PROJECTS_DDL.length} statements`)
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
  // Outside the transaction, one at a time: Postgres refuses to reference a new
  // enum value in the transaction that added it.
  for (const s of MARKETED_PROJECTS_ENUM_DDL) {
    await client.query(s)
    console.log('enum:', s.trim())
  }
  await client.end()
  console.log('done')
}

main().catch(async (e) => {
  console.error('FAILED:', e.message)
  try {
    await client.end()
  } catch {}
  process.exit(1)
})
