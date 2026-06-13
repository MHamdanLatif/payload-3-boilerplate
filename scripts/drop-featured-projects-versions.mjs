// One-shot: tear down all `_featured_projects_v` versioning artefacts after
// disabling `versions.drafts` on the FeaturedProjects collection. The mis-typed
// enums my earlier sync script created get dropped here too. Idempotent.
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
  // Drop versions table and every array-of-arrays sub-version table Payload
  // would have produced for the FeaturedProjects array fields.
  `DROP TABLE IF EXISTS "_featured_projects_v_version_elevation_images" CASCADE;`,
  `DROP TABLE IF EXISTS "_featured_projects_v_version_amenities" CASCADE;`,
  `DROP TABLE IF EXISTS "_featured_projects_v_version_photo_gallery" CASCADE;`,
  `DROP TABLE IF EXISTS "_featured_projects_v_version_unit_types" CASCADE;`,
  `DROP TABLE IF EXISTS "_featured_projects_v" CASCADE;`,

  // Drop the wrongly-typed enum (was created with draft/published values for
  // a column that should hold project-status values).
  `DROP TYPE IF EXISTS "enum__featured_projects_v_version_status" CASCADE;`,
  `DROP TYPE IF EXISTS "enum__featured_projects_v_version__status" CASCADE;`,
  `DROP TYPE IF EXISTS "enum__featured_projects_v_version_property_type" CASCADE;`,
  `DROP TYPE IF EXISTS "enum__featured_projects_v_version_project_type" CASCADE;`,
  `DROP TYPE IF EXISTS "enum__featured_projects_v_version_location" CASCADE;`,
  `DROP TYPE IF EXISTS "enum__featured_projects_v_version_unit_types_type" CASCADE;`,

  // Drop the `_status` column on the main table; we no longer track drafts.
  `ALTER TABLE "featured_projects" DROP COLUMN IF EXISTS "_status" CASCADE;`,
  `DROP TYPE IF EXISTS "enum_featured_projects_status_versions" CASCADE;`,

  // Drop FK in payload_locked_documents_rels if it points at the versions table.
  // (Safe if it doesn't exist.)
]

await client.connect()
for (const s of stmts) {
  try {
    await client.query(s)
    console.log('ok')
  } catch (e) {
    console.warn('skip:', e.message.slice(0, 120))
  }
}
await client.end()
console.log('done.')
