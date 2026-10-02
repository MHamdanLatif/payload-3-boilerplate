import { getPayload } from 'payload'
import config from '../../src/payload.config'

// Build/start run in production mode and cannot push an empty test schema.
// This script only initializes the explicitly named, local disposable database.
const url = new URL(process.env.DATABASE_URI || '')
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_e2e')) {
  throw new Error('E2E schema initialization requires a localhost database ending in _e2e.')
}
if (process.env.NODE_ENV === 'production')
  throw new Error('Initialize the test schema with NODE_ENV=development before building.')
const payload = await getPayload({ config })
await payload.destroy()
