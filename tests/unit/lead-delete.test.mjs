import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, deps = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console,
    URL,
    require: (key) => {
      if (!(key in deps)) throw Error('Unexpected import ' + key)
      return deps[key]
    },
  })
  return module.exports
}

class APIError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}
const guard = load('src/collections/Leads/hooks/guardLeadDelete.ts', { payload: { APIError } })

function fixture({ user = { id: 1, collection: 'users', financeAccess: true }, schedules = [11], deals = 1 } = {}) {
  const log = []
  const payload = {
    auth: async () => ({ user }),
    findByID: async ({ id }) => {
      if (Number(id) !== 8) throw Error('Not found')
      return { id: 8 }
    },
    find: async ({ collection }) => ({
      docs:
        collection === 'lead-schedules'
          ? schedules.map((id) => ({ id }))
          : Array.from({ length: deals }, () => ({ clientName: 'Ali', saleValue: 100 })),
    }),
    delete: async (args) => {
      log.push(['delete', args.collection, args.where ?? args.id, args.req?.transactionID, args.req?.context])
      return args.id ? { id: args.id } : { docs: [], errors: [] }
    },
    db: {
      beginTransaction: async () => 'tx',
      commitTransaction: async (id) => log.push(['commit', id]),
      rollbackTransaction: async (id) => log.push(['rollback', id]),
    },
  }
  const route = load('src/app/api/crm/leads/[id]/route.ts', {
    'next/server': {
      NextResponse: {
        json: (data, opts) => new Response(JSON.stringify(data), { status: opts?.status || 200 }),
      },
    },
    payload: { getPayload: async () => payload, createLocalReq: async ({ user, context }) => ({ user, context }) },
    '@payload-config': {},
    '@/lib/crm-input': {},
    '@/lib/lead-status': { LEAD_STATUSES: [] },
    '@/utilities/getURL': { getServerSideURL: () => 'https://crm.test' },
    '@/access/finance': { hasFinanceAccess: (u) => u?.financeAccess === true },
    '@/lib/finance-query': { rupees: (n) => `Rs. ${n}` },
    '@/collections/Leads/hooks/guardLeadDelete': guard,
  })
  return { log, route }
}
const params = { params: Promise.resolve({ id: '8' }) }
const del = (body, origin = 'https://crm.test') =>
  new Request('https://crm.test/api/crm/leads/8', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  })

test('summary shows schedules and finance details only to finance users', async () => {
  const allowed = await (await fixture().route.GET(new Request('https://crm.test/x'), params)).json()
  assert.deepEqual(allowed, { schedules: 1, financeLinked: true, deals: ['Ali, sale value Rs. 100'], blocked: null })
  const staff = await (
    await fixture({ user: { id: 2, collection: 'users' } }).route.GET(new Request('https://crm.test/x'), params)
  ).json()
  assert.equal(staff.deals, undefined)
  assert.equal(staff.blocked, 'This lead is linked to a finance record – ask a finance admin.')
})

test('delete refuses anonymous, cross-origin, non-finance and stale confirmations', async () => {
  assert.equal((await fixture({ user: null }).route.DELETE(del({}), params)).status, 401)
  assert.equal((await fixture().route.DELETE(del({}, 'https://evil.test'), params)).status, 403)
  const staff = fixture({ user: { id: 2, collection: 'users' } })
  assert.equal((await staff.route.DELETE(del({ schedules: 1, keepFinanceDeals: true }), params)).status, 403)
  const stale = fixture({ schedules: [11, 12] })
  assert.equal((await stale.route.DELETE(del({ schedules: 1, keepFinanceDeals: true }), params)).status, 409)
  assert.equal((await fixture().route.DELETE(del({ schedules: 1 }), params)).status, 409)
  for (const f of [staff, stale]) assert.equal(f.log.length, 0)
})

test('confirmed delete removes revisions, schedules and lead in one transaction, never finance', async () => {
  const { log, route } = fixture()
  const response = await route.DELETE(del({ schedules: 1, keepFinanceDeals: true }), params)
  assert.equal(response.status, 200)
  assert.deepEqual(
    log.map((entry) => entry.slice(0, 2)),
    [
      ['delete', 'schedule-revisions'],
      ['delete', 'lead-schedules'],
      ['delete', 'leads'],
      ['commit', 'tx'],
    ],
  )
  for (const entry of log.filter((e) => e[0] === 'delete')) {
    assert.equal(entry[3], 'tx')
    assert.equal(entry[4].crmLeadDelete, true)
  }
  assert.ok(!log.some((entry) => String(entry[1]).startsWith('finance')))
})

test('a failed delete rolls back', async () => {
  // A bulk schedule delete reports per-document errors instead of throwing.
  const broken = { log: [] }
  broken.route = load('src/app/api/crm/leads/[id]/route.ts', {
    'next/server': {
      NextResponse: {
        json: (data, opts) => new Response(JSON.stringify(data), { status: opts?.status || 200 }),
      },
    },
    payload: {
      getPayload: async () => ({
        auth: async () => ({ user: { id: 1, collection: 'users', financeAccess: true } }),
        findByID: async () => ({ id: 8 }),
        find: async ({ collection }) => ({ docs: collection === 'lead-schedules' ? [{ id: 11 }] : [] }),
        delete: async () => ({ docs: [], errors: [{ message: 'locked' }] }),
        db: {
          beginTransaction: async () => 'tx',
          commitTransaction: async () => broken.log.push('commit'),
          rollbackTransaction: async () => broken.log.push('rollback'),
        },
      }),
      createLocalReq: async () => ({}),
    },
    '@payload-config': {},
    '@/lib/crm-input': {},
    '@/lib/lead-status': { LEAD_STATUSES: [] },
    '@/utilities/getURL': { getServerSideURL: () => 'https://crm.test' },
    '@/access/finance': { hasFinanceAccess: () => true },
    '@/lib/finance-query': { rupees: (n) => `Rs. ${n}` },
    '@/collections/Leads/hooks/guardLeadDelete': guard,
  })
  assert.equal((await broken.route.DELETE(del({ schedules: 1, keepFinanceDeals: false }), params)).status, 400)
  assert.deepEqual(broken.log, ['rollback'])
})

test('admin deletes are blocked when schedules or deals exist, unless the CRM confirmed', async () => {
  const req = (counts, context = {}) => ({
    context,
    payload: { count: async ({ collection }) => ({ totalDocs: counts[collection] ?? 0 }) },
  })
  await guard.guardLeadDelete({ id: 8, req: req({}) })
  await assert.rejects(
    guard.guardLeadDelete({ id: 8, req: req({ 'lead-schedules': 2, 'finance-deals': 1 }) }),
    /This lead has a payment schedule and a finance deal – delete it from the CRM/,
  )
  await assert.rejects(
    guard.guardLeadDelete({ id: 8, req: req({ 'finance-deals': 1 }) }),
    /a finance deal – delete it from the CRM, where you'll be asked what to do with it\./,
  )
  await guard.guardLeadDelete({ id: 8, req: req({ 'lead-schedules': 2 }, { crmLeadDelete: true }) })
})
