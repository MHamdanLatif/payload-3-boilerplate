import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
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
    BigInt,
  })
  return loadedModule.exports
}
const m = load('src/lib/finance-math.ts')
const rs = (pkr) => Math.round(pkr * 100)
const split = (...pcts) =>
  m.checkSplit(
    pcts.map((pct, i) => ({ key: `p${i}`, label: `P${i}`, pct })),
    'Funding',
  )

test('proportional charge allocation: 10,000 + 20,000 Meta against a 32,400 debit', () => {
  const a = m.allocateCharge(rs(32400), [
    { key: 'A', metaPaisa: rs(10000) },
    { key: 'B', metaPaisa: rs(20000) },
  ])
  assert.equal(a.additionalPaisa, rs(2400))
  assert.deepEqual(
    a.lines.map((l) => [l.key, l.additionalPaisa, l.totalPaisa]),
    [
      ['A', rs(800), rs(10800)],
      ['B', rs(1600), rs(21600)],
    ],
  )
  assert.equal(
    a.lines.reduce((s, l) => s + l.totalPaisa, 0),
    rs(32400),
    'allocations reconcile exactly to the one bank debit',
  )
  assert.equal(a.flags.length, 0)
})

test('charge allocation rounds deterministically and still reconciles to the paisa', () => {
  const lines = [
    { key: 'x', metaPaisa: 100 },
    { key: 'y', metaPaisa: 100 },
    { key: 'z', metaPaisa: 100 },
  ]
  const a = m.allocateCharge(400, lines)
  assert.deepEqual(
    a.lines.map((l) => l.additionalPaisa),
    [34, 33, 33],
  )
  assert.deepEqual(m.allocateCharge(400, lines), a, 'same input, same result')
  assert.equal(
    a.lines.reduce((s, l) => s + l.totalPaisa, 0),
    400,
  )
})

test('charge allocation flags negative differences and rejects zero Meta totals', () => {
  const a = m.allocateCharge(rs(29000), [
    { key: 'A', metaPaisa: rs(10000) },
    { key: 'B', metaPaisa: rs(20000) },
  ])
  assert.equal(a.additionalPaisa, rs(-1000))
  assert.equal(a.lines.reduce((s, l) => s + l.totalPaisa, 0), rs(29000))
  assert.equal(a.flags.length, 1)
  assert.throws(() => m.allocateCharge(rs(100), [{ key: 'A', metaPaisa: 0 }]), /total zero/)
  assert.throws(() => m.allocateCharge(0, [{ key: 'A', metaPaisa: 1 }]), /bank debit/)
})

test('participant cost allocation: 10,800 at 50/25/25', () => {
  const shares = m.allocateToParticipants(rs(10800), split(50, 25, 25))
  assert.deepEqual(
    shares.map((s) => s.paisa),
    [rs(5400), rs(2700), rs(2700)],
  )
})

test('splits must total exactly 100% with unique people', () => {
  assert.throws(() => split(50, 25, 24.9999), /must total 100%/)
  assert.throws(() => split(50, 50.00001), /four decimals/)
  assert.throws(
    () =>
      m.checkSplit([
        { key: 'a', label: 'A', pct: 50 },
        { key: 'a', label: 'A', pct: 50 },
      ]),
    /more than once/,
  )
  assert.throws(() => m.checkSplit([]), /at least one/)
  assert.equal(split(33.3333, 33.3333, 33.3334).length, 3)
  assert.equal(split(100, 0).length, 2, 'a zero-percent line is allowed')
})

test('investor shortfall: A 15,000 entitlement, B 5,000 shortfall, 10,000 actual cash', () => {
  // A and B contribute 75,000 each at 50/50, costs reach 160,000, A tops up 20,000.
  const costs = m.allocateToParticipants(rs(160000), split(50, 50))
  const pos = m.fundingPosition([
    {
      key: 'A',
      label: 'A',
      receivedPaisa: rs(95000),
      costPaisa: costs[0].paisa,
      refundPaisa: 0,
      adjustmentPaisa: 0,
    },
    {
      key: 'B',
      label: 'B',
      receivedPaisa: rs(75000),
      costPaisa: costs[1].paisa,
      refundPaisa: 0,
      adjustmentPaisa: 0,
    },
  ])
  assert.equal(pos.poolPaisa, rs(10000), 'remaining project advertising cash')
  assert.deepEqual(
    pos.participants.map((p) => [p.key, p.balancePaisa, p.shortfall]),
    [
      ['A', rs(15000), false],
      ['B', rs(-5000), true],
    ],
  )
  assert.equal(pos.participants[0].costPaisa, rs(80000), 'A is charged only their 50%')
  assert.equal(pos.participants[1].costPaisa, rs(80000), 'B is charged only their 50%')
  assert.equal(pos.participants[0].backedPaisa, rs(10000), 'only 10,000 of A is backed by cash')
  assert.equal(pos.unbackedPaisa, rs(5000))
  assert.equal(pos.deficitPaisa, 0)
  // B's later top-up clears B's own shortfall first and backs A's entitlement.
  const after = m.fundingPosition([
    { ...pos.participants[0], adjustmentPaisa: 0 },
    { ...pos.participants[1], receivedPaisa: rs(80000), adjustmentPaisa: 0 },
  ])
  assert.equal(after.participants[1].balancePaisa, 0)
  assert.equal(after.participants[0].backedPaisa, rs(15000))
})

test('project isolation: each project position uses only its own records', () => {
  // A and B share one bank account. A overspends; B has cash. They stay separate.
  const projectA = m.fundingPosition([
    {
      key: 'X',
      label: 'X',
      receivedPaisa: rs(10000),
      costPaisa: rs(15000),
      refundPaisa: 0,
      adjustmentPaisa: 0,
    },
  ])
  const projectB = m.fundingPosition([
    {
      key: 'X',
      label: 'X',
      receivedPaisa: rs(50000),
      costPaisa: rs(5000),
      refundPaisa: 0,
      adjustmentPaisa: 0,
    },
  ])
  assert.equal(projectA.deficitPaisa, rs(5000), 'A shows its own deficit')
  assert.equal(projectA.participants[0].balancePaisa, rs(-5000))
  assert.equal(projectB.poolPaisa, rs(45000), "B's money is untouched by A's deficit")
})

test('partial commission receipts apply the direct deduction once, cumulatively', () => {
  const s = m.checkSplit([
    { key: 'a', label: 'A', pct: 60 },
    { key: 'b', label: 'B', pct: 40 },
  ])
  const base = { commissionPaisa: rs(500000), deductionPaisa: rs(50000), split: s, paidPaisa: {} }
  const first = m.commissionPosition({ ...base, receivedPaisa: rs(250000) })
  assert.equal(first.distributablePaisa, rs(200000))
  assert.deepEqual(
    first.recipients.map((r) => r.entitlementPaisa),
    [rs(120000), rs(80000)],
  )
  assert.equal(first.outstandingPaisa, rs(250000))
  const second = m.commissionPosition({ ...base, receivedPaisa: rs(500000) })
  assert.equal(second.distributablePaisa, rs(450000), 'the 50,000 deduction is not applied twice')
  assert.deepEqual(
    second.recipients.map((r) => r.entitlementPaisa),
    [rs(270000), rs(180000)],
  )
  assert.equal(second.outstandingPaisa, 0)
})

test('advertising spend is not an input to commission; payouts are tracked separately', () => {
  const s = m.checkSplit([
    { key: 'a', label: 'A', pct: 60 },
    { key: 'b', label: 'B', pct: 40 },
  ])
  const pos = m.commissionPosition({
    commissionPaisa: rs(500000),
    receivedPaisa: rs(250000),
    deductionPaisa: rs(50000),
    split: s,
    paidPaisa: { a: rs(100000) },
  })
  assert.deepEqual(
    pos.recipients.map((r) => [r.entitlementPaisa, r.paidPaisa, r.unpaidPaisa]),
    [
      [rs(120000), rs(100000), rs(20000)],
      [rs(80000), 0, rs(80000)],
    ],
  )
  assert.ok(!Object.keys(m.commissionPosition).includes('advertising'))
})

test('no deductions distributes 100% of received commission; deductions above receipts floor at zero', () => {
  const s = m.checkSplit([{ key: 'me', label: 'Me', pct: 100 }])
  const none = m.commissionPosition({
    commissionPaisa: rs(100),
    receivedPaisa: rs(100),
    deductionPaisa: 0,
    split: s,
    paidPaisa: {},
  })
  assert.equal(none.recipients[0].entitlementPaisa, rs(100))
  const over = m.commissionPosition({
    commissionPaisa: rs(100),
    receivedPaisa: rs(30),
    deductionPaisa: rs(50),
    split: s,
    paidPaisa: { me: rs(10) },
  })
  assert.equal(over.distributablePaisa, 0)
  assert.equal(over.deductionShortfallPaisa, rs(20))
  assert.equal(over.overpaidPaisa, rs(10), 'an expense added after a payout flags an overpayment')
})

test('historical rules: a saved split is a snapshot independent of later defaults', () => {
  const projectDefault = [
    { key: 'a', label: 'A', pct: 35 },
    { key: 'b', label: 'B', pct: 35 },
    { key: 'c', label: 'C', pct: 30 },
  ]
  const saved = m.checkSplit(projectDefault.map((l) => ({ ...l })))
  projectDefault[0].pct = 50
  projectDefault[2].pct = 15
  const pos = m.commissionPosition({
    commissionPaisa: rs(1000),
    receivedPaisa: rs(1000),
    deductionPaisa: 0,
    split: saved,
    paidPaisa: {},
  })
  assert.deepEqual(
    pos.recipients.map((r) => r.entitlementPaisa),
    [rs(350), rs(350), rs(300)],
  )
})

test('money parsing is exact to the paisa', () => {
  assert.equal(m.toPaisa('150,000'), 15000000)
  assert.equal(m.toPaisa(0.1 + 0.2), 30)
  assert.throws(() => m.toPaisa('1.005'), /two decimals/)
  assert.throws(() => m.toPaisa(''), /amount/)
  assert.equal(m.apportion(-5, [1, 1]).reduce((a, b) => a + b, 0), -5)
})

const { phoneKey } = load('src/lib/phone-key.ts', {
  'libphonenumber-js': require('libphonenumber-js'),
})
test('phone duplicates: equivalent Pakistani formats match, names never do', () => {
  const key = '+923001234567'
  for (const raw of ['03001234567', '923001234567', '+923001234567', '0300-1234567', '00923001234567', '+92 300 1234567'])
    assert.equal(phoneKey(raw), key, raw)
  assert.notEqual(phoneKey('03001234568'), key, 'same name, different number: no match')
  assert.equal(phoneKey('+447911123456'), '+447911123456', 'international numbers are preserved')
  for (const bad of ['', '12345', 'abc', '0300', null, '+92abc'])
    assert.equal(phoneKey(bad), null, String(bad))
})
