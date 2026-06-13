// One-shot cleanup: removes orphan tables/columns left behind by previous
// FeaturedProjects schemas so Payload's dev-mode schema push doesn't prompt
// about renames. Re-runnable; every statement uses IF EXISTS.
import { readFileSync } from 'node:fs'
import pg from 'pg'

// Minimal .env parser (no dotenv dep)
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
  // Iteration 3: legacy `properties` collection orphans
  `ALTER TABLE IF EXISTS "payload_locked_documents_rels" DROP COLUMN IF EXISTS "properties_id" CASCADE;`,
  `ALTER TABLE IF EXISTS "payload_jobs_log" DROP COLUMN IF EXISTS "properties_id" CASCADE;`,
  `DROP TABLE IF EXISTS "properties" CASCADE;`,
  `DROP TYPE IF EXISTS "enum_properties_location" CASCADE;`,
  `DROP TYPE IF EXISTS "enum_properties_status" CASCADE;`,
  // Iteration 4: removed FeaturedProjects.gallery (replaced by photoGallery) +
  // removed `featured` boolean.
  `DROP TABLE IF EXISTS "featured_projects_gallery" CASCADE;`,
  `ALTER TABLE IF EXISTS "featured_projects" DROP COLUMN IF EXISTS "featured" CASCADE;`,
]

await client.connect()
for (const s of stmts) {
  try {
    await client.query(s)
    console.log('ok:', s)
  } catch (e) {
    console.warn('skip:', s, '-', e.message)
  }
}
await client.end()
console.log('done.')
