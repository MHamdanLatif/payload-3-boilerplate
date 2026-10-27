// Runs one migration's `up` (twice, to prove it is repeatable) against a disposable
// localhost *_e2e database. Never point this at production.
//   DATABASE_URI=... PAYLOAD_DB_PUSH=false corepack pnpm payload run scripts/_apply-migration-local.ts <migration-name>
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { migrations } from '../src/migrations'

const url = new URL(process.env.DATABASE_URI || '')
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_e2e'))
  throw new Error('Point DATABASE_URI at a disposable localhost database ending in _e2e.')
const name = process.argv[process.argv.length - 1]
const migration = migrations.find((m) => m.name === name)
if (!migration) throw new Error(`Unknown migration ${name}`)
const payload = await getPayload({ config })
const db = (payload.db as unknown as { drizzle: unknown }).drizzle
for (const run of [1, 2]) {
  await migration.up({ db, payload, req: {} } as never)
  console.log(`${name}: up run ${run} ok`)
}
await payload.destroy()
process.exit(0)
