import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(file, deps = {}) {
  const loadedModule = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module: loadedModule,
    exports: loadedModule.exports,
    require: (name) => {
      if (!(name in deps)) throw Error(name)
      return deps[name]
    },
    console,
    crypto,
  })
  return loadedModule.exports
}
const access = load('src/access/finance.ts')
const { period, positiveID, pageNumber } = load('src/lib/finance-query.ts', {
  '@payloadcms/db-postgres': { sql: () => '' },
})
test('finance authorization fails closed and only designated users can manage access', () => {
  for (const user of [
    null,
    {},
    { collection: 'users' },
    { collection: 'leads', financeAdmin: true },
    { collection: 'users', financeAccess: 'true' },
  ])
    assert.equal(access.hasFinanceAccess(user), false)
  assert.equal(access.hasFinanceAccess({ collection: 'users', financeAccess: true }), true)
  assert.equal(access.isFinanceAdmin({ collection: 'users', financeAccess: true }), false)
  assert.equal(access.isFinanceAdmin({ collection: 'users', financeAdmin: true }), true)
})
test('date ranges handle leap years and reject impossible dates without SQL errors', () => {
  assert.equal(period({ period: 'month', month: '2024-02' }).end, '2024-02-29')
  assert.equal(period({ period: 'range', from: '2026-09-01', to: '2026-10-31' }).end, '2026-10-31')
  assert.notEqual(
    period({ period: 'range', from: '2026-02-31', to: '2026-03-31' }).start,
    '2026-02-31',
  )
  assert.equal(period({ period: 'all' }).start, '')
  assert.equal(pageNumber({ page: 'Infinity' }), 1)
  assert.equal(pageNumber({ page: '1.2' }), 1)
  assert.equal(positiveID('1 OR 1=1'), 0)
})
// Collections now also load the shared arithmetic and the transaction helpers; the
// helpers are stubbed because these tests never touch a database.
const financeDeps = {
  '@/access/finance': access,
  '@/lib/finance-math': load('src/lib/finance-math.ts'),
  '@/lib/finance-tx': {
    financeAudit: async ({ doc }) => doc,
    ledgerSum: async () => [],
    lockFinance: async () => {},
  },
  '@payloadcms/db-postgres': { sql: Object.assign(() => '', { raw: () => '' }) },
  payload: { APIError: class extends Error {} },
}
const { FinanceReceipts, FinanceExpenses } = load('src/collections/Finance.ts', financeDeps)
test('money validation rejects negative, nonfinite, missing and fractional-paisa amounts', () => {
  for (const collection of [FinanceReceipts, FinanceExpenses]) {
    const amount = collection.fields.find((f) => f.name === 'amount')
    for (const invalid of [-1, NaN, Infinity, undefined, 0.001])
      assert.notEqual(amount.validate(invalid), true)
    for (const valid of [0, 0.01, 150000, 100.25]) assert.equal(amount.validate(valid), true)
    assert.equal(collection.access.delete({ req: { user: null } }), false)
    assert.equal(
      collection.access.delete({ req: { user: { collection: 'users', financeAccess: true } } }),
      true,
    )
  }
})
test('transaction edits cannot rewrite posted financial identity or restore a voided entry', async () => {
  const hook = FinanceExpenses.hooks.beforeChange[0]
  const originalDoc = {
    id: 1,
    amount: 100,
    category: 'Meta Ads',
    date: '2026-10-01',
    createdBy: 2,
    entryKey: 'original',
  }
  const args = {
    operation: 'update',
    originalDoc,
    collection: { slug: 'finance-expenses' },
    req: { user: { id: 3 } },
  }
  await assert.rejects(() => hook({ ...args, data: { amount: 200 } }), /Posted amount/)
  await assert.rejects(() => hook({ ...args, data: { voided: true } }), /reason/)
  const data = await hook({
    ...args,
    data: { voided: true, voidReason: 'Correction', createdBy: 999, entryKey: 'changed' },
  })
  assert.equal(data.createdBy, 2)
  assert.equal(data.updatedBy, 3)
  assert.equal(data.entryKey, 'original')
  await assert.rejects(
    () => hook({ ...args, originalDoc: { ...originalDoc, voided: true }, data: { voided: false } }),
    /cannot be restored/,
  )
})
const { exportValue } = load('src/lib/finance-query.ts', {
  '@payloadcms/db-postgres': { sql: () => '' },
})
test('ledger tabs can default to all dates while summary pages keep the current month', () => {
  assert.equal(period({}, 'all').start, '')
  assert.equal(period({ period: '' }, 'all').label, 'All time')
  assert.notEqual(period({}).start, '')
  assert.equal(period({ period: 'month', month: '2026-09' }, 'all').start, '2026-09-01')
})
test('exports write dates and timestamps in Pakistan time', () => {
  // PKT midnight is 19:00 UTC the previous day; it must still export as the PKT date.
  assert.equal(exportValue('date', new Date('2026-10-04T19:00:00Z')), '2026-10-05')
  assert.equal(exportValue('date_closed', '2026-10-04T19:00:00.000Z'), '2026-10-05')
  assert.equal(exportValue('expected_payment_date', new Date('2026-12-31T19:00:00Z')), '2027-01-01')
  assert.equal(exportValue('created_at', new Date('2026-10-04T20:30:00Z')), '2026-10-05 01:30')
  assert.equal(exportValue('updated_at', null), null)
  assert.equal(exportValue('amount', '1500'), '1500')
  assert.equal(exportValue('client_name', 'Ali'), 'Ali')
})
test('deleting a deal keeps its expenses, unlinked with the project kept, and deletes receipts', async () => {
  const { FinanceDeals } = load('src/collections/Finance.ts', financeDeps)
  const calls = []
  const req = {
    context: { original: true },
    payload: {
      findByID: async () => ({ id: 7, clientName: 'Ali', project: { id: 3, title: 'Tulip' } }),
      find: async () => ({ docs: [{ id: 11, notes: 'Paid cash' }, { id: 12 }] }),
      update: async (args) => calls.push(['update', args]),
      delete: async (args) => (calls.push(['delete', args.collection]), { errors: [] }),
    },
  }
  await FinanceDeals.hooks.beforeDelete[0]({ id: 7, req })
  const updates = calls.filter((c) => c[0] === 'update').map((c) => c[1])
  assert.deepEqual(
    updates.map((u) => [u.id, u.data.deal, u.data.project, u.req, u.context.unlinkDeletedDeal]),
    [
      [11, null, 3, req, true],
      [12, null, 3, req, true],
    ],
  )
  assert.equal(updates[0].data.notes, 'Paid cash\nLinked deal deleted: Ali · Tulip.')
  assert.deepEqual(
    calls.filter((c) => c[0] === 'delete').map((c) => c[1]),
    ['finance-receipts', 'finance-receivables'],
  )
  assert.deepEqual(req.context, { original: true }, 'shared request context is restored')
  req.payload.delete = async () => ({ errors: [{ message: 'denied' }] })
  await assert.rejects(() => FinanceDeals.hooks.beforeDelete[0]({ id: 7, req }), /Nothing was deleted/)
})
test('only the deal-delete hook may detach an expense from its deal', async () => {
  const hook = FinanceExpenses.hooks.beforeChange[0]
  const args = {
    operation: 'update',
    originalDoc: { id: 1, amount: 100, deal: 7, project: 9, createdBy: 2, entryKey: 'k' },
    collection: { slug: 'finance-expenses' },
    req: { user: { id: 3 }, payload: { findByID: async () => ({ id: 8 }) } },
  }
  await assert.rejects(() => hook({ ...args, data: { deal: null, project: 3 } }), /Posted (project|deal)/)
  await assert.rejects(
    () => hook({ ...args, context: { unlinkDeletedDeal: true }, data: { deal: 8 } }),
    /Posted deal/,
  )
  await assert.rejects(
    () =>
      hook({ ...args, context: { unlinkDeletedDeal: true }, data: { deal: null, amount: 5 } }),
    /Posted amount/,
  )
  const data = await hook({
    ...args,
    context: { unlinkDeletedDeal: true },
    data: { deal: null, project: 3 },
  })
  assert.equal(data.deal, null)
  assert.equal(data.project, 3)
})
