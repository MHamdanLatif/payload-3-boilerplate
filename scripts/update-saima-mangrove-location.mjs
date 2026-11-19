// Dry run: node scripts/update-saima-mangrove-location.mjs
// Apply: node scripts/update-saima-mangrove-location.mjs --apply
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

const require = createRequire(import.meta.url)
const pg = createRequire(require.resolve('@payloadcms/db-postgres'))('pg')
const env = parseEnv(readFileSync('.env', 'utf8'))
const client = new pg.Client({ connectionString: process.env.DATABASE_URI || env.DATABASE_URI })
const title = 'Saima Mangrove Residences'
const tables = ['featured_projects', 'marketed_projects']

try {
  await client.connect()
  let matches = 0
  for (const table of tables) {
    const result = await client.query(
      `SELECT id, title, slug, location FROM "${table}" WHERE lower(title) = lower($1)`, [title],
    )
    matches += result.rowCount
    console.log(table, result.rows)
  }
  if (!matches) throw new Error('No matching project found; nothing changed.')
  if (process.argv.includes('--apply')) {
    // Commit enum additions before using the new value in data updates.
    for (const table of [...tables, 'property_listings']) {
      await client.query(`ALTER TYPE "enum_${table}_location" ADD VALUE IF NOT EXISTS 'Korangi Creek'`)
    }
    await client.query('BEGIN')
    try {
      for (const table of tables) {
        const result = await client.query(
          `UPDATE "${table}" SET location = 'Korangi Creek', updated_at = now()
           WHERE lower(title) = lower($1) AND location = 'Korangi'
           RETURNING id, title, location`, [title],
        )
        console.log('Updated', table, result.rows)
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
