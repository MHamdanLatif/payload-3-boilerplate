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
const { FinanceReceipts, FinanceExpenses } = load('src/collections/Finance.ts', {
  '@/access/finance': access,
  payload: { APIError: class extends Error {} },
})
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
