import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

// Requires an explicitly supplied Postgres URI. Every test table is temporary,
// shadows the production table name, and is discarded by ROLLBACK.
const require = createRequire(import.meta.url)
const { Client } = require(
  require.resolve('pg', { paths: [require.resolve('@payloadcms/db-postgres')] }),
)
const uri = process.env.CRM_QUEUE_TEST_DATABASE_URI
if (!uri) throw Error('Set CRM_QUEUE_TEST_DATABASE_URI to run isolated temporary-table tests.')
const client = new Client({ connectionString: uri, connectionTimeoutMillis: 10000 })
await client.connect()
try {
  await client.query('BEGIN')
  await client.query(`
    CREATE TEMP TABLE crm_settings (id integer PRIMARY KEY, notification_start_at timestamptz, automatic_uncontacted_reminders boolean);
    INSERT INTO crm_settings VALUES (1, NOW() - INTERVAL '3 hours', true);
    CREATE TEMP TABLE leads (id integer PRIMARY KEY, created_at timestamptz, status text, owner_notified_at timestamptz, owner_notify_status text);
    CREATE TEMP TABLE lead_notifications (
      id serial PRIMARY KEY, event_key text UNIQUE, lead_id integer, kind text, due_at timestamptz,
      expires_at timestamptz, retry_at timestamptz, claim text, finished_at timestamptz,
      attempts numeric DEFAULT 0, receipts jsonb, delivery_status text, created_at timestamptz, updated_at timestamptz
    );
    INSERT INTO leads (id,created_at,status,owner_notified_at) VALUES
      (1,NOW()-INTERVAL '5 minutes','unqualified',NULL),
      (2,NOW()-INTERVAL '31 minutes','unqualified',NOW()),
      (3,NOW()-INTERVAL '121 minutes','unqualified',NOW()),
      (4,NOW()-INTERVAL '31 minutes','contacted',NOW()),
      (5,NOW()-INTERVAL '1 day','unqualified',NULL);
  `)
  const sql = (parts, ...values) => ({
    text: parts.reduce((s, part, i) => s + part + (i < values.length ? '$' + (i + 1) : ''), ''),
    values,
  })
  let outcome = { ok: true, status: 'Accepted', pendingDevices: 1 }
  const sends = [],
    updates = []
  const payload = {
    db: { drizzle: { execute: (query) => client.query(query.text, query.values) } },
    findGlobal: async () => ({
      automaticUncontactedReminders: (
        await client.query('SELECT automatic_uncontacted_reminders FROM crm_settings')
      ).rows[0].automatic_uncontacted_reminders,
    }),
    findByID: async ({ collection, id }) => {
      const table = collection === 'leads' ? 'leads' : 'lead_notifications'
      const row = (await client.query('SELECT * FROM ' + table + ' WHERE id=$1', [id])).rows[0]
      if (!row) throw Error('Not found')
      return { ...row, lead: row.lead_id, name: 'Fixture', phone: '+923000000000' }
    },
    update: async (value) => updates.push(value),
  }
  const deps = {
    'node:crypto': { randomUUID },
    '@payloadcms/db-postgres': { sql },
    './crm-push': {
      crmPushConfigured: () => true,
      sendCrmPush: async (_p, message, _only, delivery) => {
        sends.push({ message, delivery })
        return outcome
      },
    },
    './lead-notification-message': {
      leadNotificationMessage: (lead, kind) => ({ id: lead.id, kind }),
    },
    './lead-action-link': { signLeadAction: () => 'signed' },
  }
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('src/lib/lead-notification-queue.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console,
    Date,
    require: (name) => {
      if (!(name in deps)) throw Error(name)
      return deps[name]
    },
  })
  const { reconcileLeadNotifications, deliverLeadNotifications } = module.exports
  await reconcileLeadNotifications(payload)
  await reconcileLeadNotifications(payload)
  const rows = (
    await client.query(
      'SELECT lead_id,kind,finished_at,due_at FROM lead_notifications ORDER BY lead_id,kind',
    )
  ).rows
  assert.equal(
    rows.length,
    7,
    'three jobs for new lead, two each for already-alerted Uncontacted leads',
  )
  assert.ok(
    !rows.some((r) => [4, 5].includes(r.lead_id)),
    'contacted and pre-cutoff leads are excluded',
  )
  assert.ok(
    rows.find((r) => r.lead_id === 3 && r.kind === '30m').finished_at,
    'overdue first reminder is superseded',
  )
  await deliverLeadNotifications(payload)
  assert.deepEqual(
    sends.map((s) => [s.message.id, s.message.kind]).sort((a, b) => a[0] - b[0]),
    [
      [1, 'new'],
      [2, '30m'],
      [3, '2h'],
    ],
  )
  assert.equal(
    (
      await client.query(
        'SELECT count(*)::int n FROM lead_notifications WHERE finished_at IS NULL AND attempts=1',
      )
    ).rows[0].n,
    3,
    'provider acceptance alone leaves jobs pending',
  )
  const firstCount = sends.length
  await deliverLeadNotifications(payload)
  assert.equal(sends.length, firstCount, 'lease prevents an immediate duplicate on restart')
  await client.query(
    "UPDATE lead_notifications SET retry_at=NOW()-INTERVAL '1 second' WHERE attempts=1",
  )
  await client.query("UPDATE leads SET status='contacted' WHERE id=2")
  outcome = { ok: true, status: 'Display confirmed', pendingDevices: 0 }
  await deliverLeadNotifications(payload)
  assert.ok(
    !sends.slice(firstCount).some((s) => s.message.id === 2),
    'status rechecked before retry',
  )
  assert.equal(
    (
      await client.query("SELECT delivery_status FROM lead_notifications WHERE event_key='2:30m'")
    ).rows[0].delivery_status.startsWith('Cancelled'),
    true,
  )
  assert.equal(
    updates.find((u) => u.data.ownerNotifiedAt).data.ownerNotifyStatus,
    'CRM push: display confirmed by app',
  )
  await client.query('UPDATE crm_settings SET automatic_uncontacted_reminders=false')
  await client.query(
    "UPDATE lead_notifications SET due_at=NOW()-INTERVAL '1 second' WHERE finished_at IS NULL",
  )
  const beforeDisabled = sends.length
  await deliverLeadNotifications(payload)
  assert.equal(sends.length, beforeDisabled, 'global switch cancels pending automatic reminders')
  await client.query(
    "INSERT INTO leads (id,created_at,status) VALUES (6,NOW()-INTERVAL '1 minute','unqualified')",
  )
  const find = payload.findByID
  payload.findByID = async (args) => {
    if (args.collection === 'leads' && args.id === 6) throw Error('Temporary database failure')
    return find(args)
  }
  await assert.rejects(deliverLeadNotifications(payload), /Temporary database failure/)
  assert.equal(
    (await client.query("SELECT finished_at FROM lead_notifications WHERE event_key='6:new'"))
      .rows[0].finished_at,
    null,
    'database errors must never cancel alerts',
  )
  payload.findByID = find
  await client.query(
    "UPDATE lead_notifications SET retry_at=NOW()-INTERVAL '1 second' WHERE event_key='6:new'",
  )
  outcome = { ok: false, status: 'Temporary delivery failure', pendingDevices: 1 }
  await deliverLeadNotifications(payload)
  assert.equal(
    (await client.query("SELECT finished_at FROM lead_notifications WHERE event_key='6:new'"))
      .rows[0].finished_at,
    null,
  )
  await client.query(
    "UPDATE lead_notifications SET expires_at=NOW()-INTERVAL '1 second', retry_at=NULL WHERE event_key='6:new'",
  )
  await reconcileLeadNotifications(payload)
  assert.equal(
    (await client.query('SELECT owner_notify_status FROM leads WHERE id=6')).rows[0]
      .owner_notify_status,
    'CRM push: expired without app display confirmation',
  )
  console.log(
    'PASS: real PostgreSQL reconciliation, unique jobs, 30m/2h timing, new-only cutoff, restart leases, display confirmation, status changes and disabling; temporary tables only.',
  )
} finally {
  await client.query('ROLLBACK')
  await client.end()
}
