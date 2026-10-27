// Prints the DDL drizzle-kit would run to bring a database up to the current Payload
// schema, without running it. Used to write hand-applied production migrations.
//   DATABASE_URI=<disposable localhost *_e2e db at the previous schema> PAYLOAD_DB_PUSH=false \
//     corepack pnpm payload run scripts/_print-schema-diff.ts
import { getPayload } from 'payload'
import config from '../src/payload.config'

const url = new URL(process.env.DATABASE_URI || '')
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_e2e'))
  throw new Error('Point DATABASE_URI at a disposable localhost database ending in _e2e.')
if (process.env.PAYLOAD_DB_PUSH !== 'false') throw new Error('Set PAYLOAD_DB_PUSH=false.')
const payload = await getPayload({ config })
const db = payload.db as unknown as {
  schema: unknown
  drizzle: unknown
  requireDrizzleKit: () => {
    pushSchema: (
      schema: unknown,
      drizzle: unknown,
    ) => Promise<{ statementsToExecute: string[]; warnings: string[] }>
  }
}
const { statementsToExecute, warnings } = await db.requireDrizzleKit().pushSchema(db.schema, db.drizzle)
for (const w of warnings) console.error('-- WARNING:', w)
console.log(statementsToExecute.map((s) => s.trim().replace(/;?$/, ';')).join('\n'))
await payload.destroy()
process.exit(0)
