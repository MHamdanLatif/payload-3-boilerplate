/**
 * Apply only this rollout's migrations on installations whose previous schema
 * migrations were applied manually. Always take a database backup first.
 * Run with NODE_ENV=production so Payload cannot push unrelated schema changes.
 */
import { createLocalReq, getPayload } from 'payload'
import config from '../src/payload.config'
import { up as schema } from '../src/migrations/20261008_000000_project_marketing'
import { up as content } from '../src/migrations/20261008_000001_project_marketing_content'

if (process.env.NODE_ENV !== 'production')
  throw new Error('Run with NODE_ENV=production to disable schema push.')
// Payload's run command consumes CLI flags; the explicit environment flag also
// works through that runner without relying on argument forwarding.
if (!process.argv.includes('--apply') && process.env.APPLY_PROJECT_MARKETING !== 'true')
  throw new Error(
    'Set APPLY_PROJECT_MARKETING=true after reviewing the blog audit and taking a database backup.',
  )
const payload = await getPayload({ config })
const req = await createLocalReq({}, payload)
try {
  await payload.db.drizzle.transaction(async (db) => {
    await schema({ db, payload, req })
  })
  await payload.db.drizzle.transaction(async (db) => {
    await content({ db, payload, req })
  })
  payload.logger.info(
    'Project marketing rollout applied. Deploy/restart the matching application to refresh cached pages.',
  )
} finally {
  await payload.destroy()
}
