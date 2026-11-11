// Hand-applies migration 20261111_000000_finance_projects to the database in DATABASE_URI
// (production is updated by hand; Railway never runs migrations).
//   node --env-file=.env scripts/_apply-finance-projects-prod.mjs            # dry run: backup + checks, no writes
//   node --env-file=.env scripts/_apply-finance-projects-prod.mjs --apply    # backup, then apply in one transaction
// Before any write it saves JSON copies of every existing table the migration alters.
// Preserves existing advertising project IDs and redirects their foreign keys.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

// pnpm links packages, so resolve pg from db-postgres's real location.
const require = createRequire(
  realpathSync(fileURLToPath(new URL('../node_modules/@payloadcms/db-postgres/package.json', import.meta.url))),
)
const { Client } = require('pg')
const apply = process.argv.includes('--apply')
const NAME = '20261111_000000_finance_projects'

// Pull the SQL out of the migration file so this script runs exactly what was tested.
const source = readFileSync(new URL(`../src/migrations/${NAME}.ts`, import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const statements = []
const mod = { exports: {} }
const raw = (s) => ({ text: s })
const tag = (strings, ...values) => ({ text: strings.reduce((a, s, i) => a + s + (i < values.length ? values[i] : ''), '') })
tag.raw = raw
new Function('module', 'exports', 'require', js)(mod, mod.exports, (n) => {
  if (n === '@payloadcms/db-postgres') return { sql: tag }
  throw new Error(n)
})
await mod.exports.up({ db: { execute: async (q) => statements.push(q.text) } })

const client = new Client({ connectionString: process.env.DATABASE_URI, ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URI || '') ? false : { rejectUnauthorized: false } })
await client.connect()
const host = new URL(process.env.DATABASE_URI).hostname
console.log(`Database host: ${host}. Mode: ${apply ? 'APPLY' : 'dry run'}`)
const [{ applied }] = (await client.query(`SELECT COUNT(*)::int AS applied FROM payload_migrations WHERE name=$1`, [NAME])).rows
console.log(`Already recorded in payload_migrations: ${applied ? 'yes' : 'no'}`)

if (applied) {
  console.log('Migration already applied; no changes needed.');
  await client.end();
  process.exit(0);
}

const backupDir = path.resolve('backups', `${NAME}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(backupDir, { recursive: true })
for (const table of ['featured_projects', 'marketed_projects', 'finance_project_rules', 'finance_campaigns', 'finance_funding', 'finance_ad_charges_lines', 'finance_ad_charges_shares']) {
  const rows = (await client.query(`SELECT * FROM ${table}`)).rows
  writeFileSync(path.join(backupDir, `${table}.json`), JSON.stringify(rows))
  console.log(`Backed up ${table}: ${rows.length} rows`)
}
console.log(`Backup folder: ${backupDir}`)

if (!apply) {
  console.log(`Dry run: ${statements.length} statement groups would run. Nothing was changed.`)
  await client.end()
  process.exit(0)
}
try {
  await client.query('BEGIN')
  for (const s of statements) await client.query(s)
  if (!applied) await client.query(`INSERT INTO payload_migrations(name, batch) VALUES ($1, (SELECT COALESCE(MAX(batch),0)+1 FROM payload_migrations))`, [NAME])
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  console.error('Rolled back. Nothing was changed.')
  throw error
}
console.log('Finance project migration committed.');
await client.end();
