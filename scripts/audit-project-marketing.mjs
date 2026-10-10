// Read-only content inventory. Never logs credentials or reads leads/finance.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const dbRequire = createRequire(require.resolve('@payloadcms/db-postgres'))
const { Client } = dbRequire('pg')
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
  const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
}))
const client = new Client({ connectionString: env.DATABASE_URI, connectionTimeoutMillis: 15000 })
try {
  await client.connect()
  await client.query('BEGIN READ ONLY')
  const data = {}
  for (const table of ['blogs', 'blogs_featured_cards', 'featured_projects', 'marketed_projects', 'property_listings']) {
    data[table] = (await client.query(`SELECT * FROM "${table}"`)).rows
  }
  await client.query('ROLLBACK')
  mkdirSync('tmp/project-marketing', { recursive: true })
  writeFileSync('tmp/project-marketing/content-audit.json', JSON.stringify(data, null, 2))
  console.log(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])))
} finally { await client.end() }
