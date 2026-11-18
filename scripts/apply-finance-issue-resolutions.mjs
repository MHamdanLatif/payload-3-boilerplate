// Scoped production rollout; never run the historical migration queue here.
// Dry run: node --env-file=.env scripts/apply-finance-issue-resolutions.mjs
// Apply after a full backup: set NODE_ENV=production and
// APPLY_FINANCE_ISSUE_RESOLUTIONS=true, then add --apply.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

const name = '20261118_000000_finance_issue_resolutions'
const apply = process.argv.includes('--apply')
if (apply && (process.env.NODE_ENV !== 'production' || process.env.APPLY_FINANCE_ISSUE_RESOLUTIONS !== 'true'))
  throw new Error('Set NODE_ENV=production and APPLY_FINANCE_ISSUE_RESOLUTIONS=true after taking a full backup.')
if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required.')

const require = createRequire(realpathSync(fileURLToPath(new URL('../node_modules/@payloadcms/db-postgres/package.json', import.meta.url))))
const { Client } = require('pg')
const source = readFileSync(new URL(`../src/migrations/${name}.ts`, import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const statements = []
const mod = { exports: {} }
const tag = (strings, ...values) => {
  if (values.length) throw new Error('This rollout supports literal migration SQL only.')
  return { text: strings.join('') }
}
new Function('module', 'exports', 'require', js)(mod, mod.exports, (dependency) => {
  if (dependency === '@payloadcms/db-postgres') return { sql: tag }
  throw new Error(`Unexpected dependency: ${dependency}`)
})
await mod.exports.up({ db: { execute: async (query) => statements.push(query.text) } })

const client = new Client({ connectionString: process.env.DATABASE_URI })
try {
  await client.connect()
  console.log(`Database host: ${new URL(process.env.DATABASE_URI).hostname}; mode: ${apply ? 'apply' : 'transactional dry run'}`)
  await client.query('BEGIN')
  await client.query("SET LOCAL lock_timeout = '10s'")
  await client.query("SET LOCAL statement_timeout = '60s'")
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [name])
  const applied = (await client.query('SELECT id FROM payload_migrations WHERE name=$1', [name])).rowCount > 0
  if (!applied) {
    if (apply) {
      const backup = { migration: name, capturedAt: new Date().toISOString() }
      for (const table of ['payload_locked_documents_rels', 'payload_migrations']) {
        backup[table] = (await client.query(`SELECT * FROM ${table}`)).rows
      }
      backup.columns = (await client.query("SELECT * FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('payload_locked_documents_rels','payload_migrations')")).rows
      backup.constraints = (await client.query("SELECT conname, conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('payload_locked_documents_rels'::regclass,'payload_migrations'::regclass)")).rows
      backup.indexes = (await client.query("SELECT * FROM pg_indexes WHERE schemaname='public' AND tablename IN ('payload_locked_documents_rels','payload_migrations')")).rows
      const directory = path.resolve('tmp/finance-issue-resolutions-release')
      mkdirSync(directory, { recursive: true })
      const destination = path.join(directory, `before-${Date.now()}.json`)
      writeFileSync(destination, JSON.stringify(backup, null, 2), { mode: 0o600 })
      console.log(`Affected records and schema backed up to ${destination}`)
    }
    for (const statement of statements) await client.query(statement)
    await client.query('INSERT INTO payload_migrations(name,batch) SELECT $1,COALESCE(MAX(batch) FILTER (WHERE batch>0),0)+1 FROM payload_migrations', [name])
  }
  await client.query('SELECT id,fingerprint,title,detail,href,note,resolved_by,reopened_at,created_at,updated_at FROM finance_issue_resolutions LIMIT 0')
  await client.query('SELECT finance_issue_resolutions_id FROM payload_locked_documents_rels LIMIT 0')
  const indexes = (await client.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='finance_issue_resolutions'")).rows
  if (indexes.length !== 4) throw new Error('Expected primary key and three resolution indexes.')
  await client.query(apply ? 'COMMIT' : 'ROLLBACK')
  console.log(applied ? 'Migration already applied; schema verified.' : apply ? 'Migration applied, verified and recorded.' : 'Migration SQL verified; dry-run transaction rolled back.')
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('Migration failed; transaction rolled back.')
  // Avoid printing connection strings or row contents from database errors.
  console.error(error.code || error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
