import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import crypto from 'node:crypto'

function load(file, deps = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      if (!(name in deps)) throw Error(`Missing test dependency: ${name}`)
      return deps[name]
    },
    Response,
    Buffer,
    console,
    AbortSignal,
    process: { env: {} },
  })
  return module.exports
}
const heads = load('src/lib/payment-heads.ts')
const engine = load('src/lib/payment-plan.ts', { './payment-heads': heads })
const admin = load('src/lib/admin-payment-plan.ts', {
  './payment-heads': heads,
  './payment-plan': engine,
})
const regularHeads = heads.DEFAULT_PAYMENT_HEADS.filter(
  (h) => !['Grey Structure', 'Finishing'].includes(h.category),
)
const base = {
  unitPrice: 10000000,
  loanIncluded: false,
  loanAmount: 0,
  totalDurationMonths: 36,
  downPaymentPct: 20,
  possessionPct: 5,
  heads: regularHeads,
  installments: [{ kind: 'Monthly', active: true, locked: false, valuePerPeriod: 0 }],
}
const sum = (rows) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100

test('fixed amounts are preserved and underallocation is explicit', () => {
  const p = engine.computePlan({
    ...base,
    installments: [{ kind: 'Monthly', active: true, locked: true, valuePerPeriod: 100000 }],
  })
  assert.equal(p.totals.downPayment, 2000000)
  assert.equal(p.rows[0].amount, 2000000)
  assert.ok(p.warnings.some((w) => w.includes('remaining')))
})
test('milestone totals agree with schedule after entered installments', () => {
  const p = engine.computePlan({
    ...base,
    heads: heads.DEFAULT_PAYMENT_HEADS,
    installments: [{ kind: 'Monthly', active: true, locked: true, valuePerPeriod: 100000 }],
  })
  assert.equal(sum(p.rows), 10000000)
  assert.equal(p.totals.milestoneTotal, sum(p.rows.filter((r) => r.kind === 'milestone')))
  assert.equal(p.totals.greyTotal, p.totals.finishingTotal)
  assert.equal(p.warnings.length, 0)
})
test('limits, missing heads, invalid loans and nonfinite amounts are rejected', () => {
  for (const patch of [
    { downPaymentPct: 80, downPaymentMaxPct: 30 },
    { possessionPct: 5, possessionCap: 2 },
    { heads: [], availableHeads: heads.DEFAULT_PAYMENT_HEADS, installments: [] },
    { loanIncluded: true, loanAmount: 11000000 },
    { installments: [{ kind: 'Monthly', active: true, locked: true, valuePerPeriod: Infinity }] },
  ])
    assert.ok(engine.computePlan({ ...base, ...patch }).warnings.length)
})
test('calculated rounding balances both tiny and normal prices without negative rows', () => {
  for (const unitPrice of [1, 10.01, 10000000, 12000000.99]) {
    const p = engine.computePlan({ ...base, unitPrice, totalDurationMonths: 84 })
    assert.equal(sum(p.rows), unitPrice)
    assert.ok(p.rows.every((r) => r.amount >= 0 && Number.isFinite(r.amount)))
    assert.equal(p.warnings.length, 0)
    const phased = engine.computePlan({ ...base, unitPrice, heads: heads.DEFAULT_PAYMENT_HEADS })
    assert.equal(sum(phased.rows), unitPrice)
    assert.equal(phased.warnings.length, 0)
    assert.ok(phased.rows.every((r) => r.amount >= 0))
  }
})
const custom = {
  projectId: 1,
  unitId: 'unit-1',
  basePrice: 10000000,
  duration: 36,
  charges: [],
  discounts: [],
  heads: [
    {
      id: 'dp',
      name: 'Down payment',
      kind: 'down-payment',
      amount: 2000000,
      method: 'entered',
      count: 1,
      firstMonth: 0,
      intervalMonths: 0,
    },
    {
      id: 'monthly',
      name: 'Monthly',
      kind: 'installment',
      amount: 0,
      method: 'calculated',
      count: 36,
      firstMonth: 1,
      intervalMonths: 1,
    },
    {
      id: 'possession',
      name: 'Possession',
      kind: 'possession',
      amount: 500000,
      method: 'entered',
      count: 1,
      firstMonth: 37,
      intervalMonths: 0,
    },
  ],
}
test('separate month-6 parking charge leaves every regular payment unchanged', () => {
  const before = admin.computeAdminPlan(custom)
  const after = admin.computeAdminPlan({
    ...custom,
    charges: [{ id: 'parking', name: 'Parking', amount: 500000, separate: true, month: 6 }],
  })
  assert.equal(after.finalPrice, 10500000)
  assert.equal(after.regularPrice, before.regularPrice)
  const payments = (rows) =>
    rows.filter((r) => r.kind !== 'extra-charge').map((r) => [r.headName, r.monthOffset, r.amount])
  assert.deepEqual(payments(after.plan.rows), payments(before.plan.rows))
  assert.equal(after.remaining, 0)
  assert.equal(after.plan.rows.find((r) => r.kind === 'extra-charge').monthOffset, 6)
})
test('discount and regular charges flow only into calculated payments', () => {
  const p = admin.computeAdminPlan({
    ...custom,
    discounts: [{ id: 'discount', name: 'Offer', amount: 250000 }],
    charges: [{ id: 'fee', name: 'Fee', amount: 100000, separate: false, month: 0 }],
  })
  assert.equal(p.finalPrice, 9850000)
  assert.equal(p.remaining, 0)
  assert.equal(p.plan.totals.downPayment, 2000000)
  assert.equal(p.plan.totals.possession, 500000)
})
test('admin rejects overallocated plans, invalid amounts and excessive schedules', () => {
  assert.ok(admin.computeAdminPlan({ ...custom, basePrice: 100 }).plan.warnings.length)
  assert.ok(admin.validateAdminPlan({ ...custom, basePrice: NaN }).length)
  assert.ok(
    admin.validateAdminPlan({ ...custom, heads: [{ ...custom.heads[0], count: 999999 }] }).length,
  )
})

test('project defaults retain builder installment values and project-specific milestones', () => {
  const project = {
    id: 1,
    title: 'Fixture',
    unitTypes: [
      {
        id: 'a',
        type: '2 Bed Lounge',
        rooms: 3,
        price: 10000000,
        defaultPlan: {
          downPaymentPct: 20,
          possessionPct: 5,
          installments: [
            { frequency: 'Monthly', amount: 125000, locked: true },
            { frequency: 'HalfYearly', amount: 500000, locked: true },
          ],
        },
      },
    ],
    paymentPlan: {
      totalDurationMonths: 36,
      paymentHeads: regularHeads.map((h) => ({ ...h, enabled: true })),
    },
  }
  const input = admin.initialAdminPlan(project, 'a')
  const p = admin.computeAdminPlan(input)
  assert.equal(p.remaining, 0)
  assert.equal(p.plan.rows.find((r) => r.kind === 'installment-monthly').amount, 125000)
  assert.equal(p.plan.rows.find((r) => r.kind === 'installment-halfyearly').amount, 500000)
  assert.equal(input.heads.filter((h) => h.kind === 'milestone').length, 0)
  project.unitTypes[0].defaultPlan = undefined
  project.paymentPlan.paymentHeads = heads.DEFAULT_PAYMENT_HEADS
  assert.ok(admin.initialAdminPlan(project, 'a').heads.some((h) => h.kind === 'milestone'))
})

test('admin export requires a CMS user and recalculates without recording leads', async () => {
  let user = null,
    reads = 0,
    renders = 0
  const project = {
    id: 1,
    title: 'Fixture',
    builderName: 'Builder',
    unitTypes: [{ id: 'unit-1', type: '2 Bed Lounge' }],
  }
  const { POST } = load('src/app/api/admin/payment-plan/pdf/route.ts', {
    payload: {
      getPayload: async () => ({
        auth: async () => ({ user }),
        findByID: async () => {
          reads++
          return project
        },
        create: () => {
          throw Error('Admin exports must not create leads')
        },
      }),
    },
    '@payload-config': {},
    'next/server': {
      NextResponse: {
        json: (data, options) =>
          new Response(JSON.stringify(data), { status: options?.status ?? 200 }),
      },
    },
    '@react-pdf/renderer': {
      renderToBuffer: async () => {
        renders++
        return Buffer.from('PDF')
      },
    },
    '@/lib/admin-payment-plan': admin,
    '@/components/projects/PaymentPlanPDF': {
      PaymentPlanDocument: (p) => p,
      composeDisclaimer: () => '',
    },
    '@/utilities/getURL': { getServerSideURL: () => 'http://fixture.invalid' },
  })
  const req = (plan) => ({ text: async () => JSON.stringify({ plan }), headers: new Headers() })
  assert.equal((await POST(req(custom))).status, 401)
  user = { id: 1, collection: 'customers' }
  assert.equal((await POST(req(custom))).status, 401)
  assert.equal(reads, 0)
  user = { id: 1, collection: 'users' }
  assert.equal((await POST(req({ ...custom, basePrice: 1 }))).status, 400)
  assert.equal((await POST(req(custom))).status, 200)
  assert.equal(renders, 1)
})

test('public PDF uses Auto DP, rejects guardrail bypasses, renders before recording leads', async () => {
  let writes = 0,
    captured,
    fail = false
  const project = {
    id: 1,
    title: 'Fixture',
    slug: 'fixture',
    unitTypes: [{ id: 'unit-1', type: '2 Bed Lounge', rooms: 3, price: 10000000 }],
    paymentPlan: {
      enabled: true,
      downPaymentMinPct: 10,
      downPaymentMaxPct: 50,
      possessionPct: 5,
      totalDurationMonths: 36,
      paymentHeads: regularHeads,
    },
  }
  const { POST } = load('src/app/api/payment-plan/pdf/route.ts', {
    'next/server': {
      NextResponse: {
        json: (data, options) =>
          new Response(JSON.stringify(data), { status: options?.status ?? 200 }),
      },
    },
    crypto,
    payload: {
      getPayload: async () => ({
        find: async (q) =>
          q.collection === 'leads' ? { totalDocs: 0, docs: [] } : { docs: [project] },
        create: async () => {
          writes++
          return { id: 1 }
        },
      }),
    },
    '@payload-config': {},
    'libphonenumber-js': { isValidPhoneNumber: () => true },
    '@/lib/featured-projects': {
      formatPkr: String,
      smallestUnit: () => project.unitTypes[0],
      unitKey: (u) => u.id,
    },
    '@/lib/lead-capture': { parseCookies: () => ({}), touchColumns: () => ({}) },
    '@/lib/attribution': {
      ATTRIBUTION_COOKIE: '',
      acquisitionSourceFromTouch: () => null,
      parseAttribution: () => null,
    },
    '@/lib/payment-plan-collections': { isPaymentPlanCollection: () => true },
    '@/lib/meta-capi': { sendCapiEvent: async () => {} },
    '@/lib/payment-plan': engine,
    '@/lib/payment-heads': heads,
    '@/components/projects/PaymentPlanPDF': {
      PaymentPlanDocument: (p) => {
        captured = p
        return p
      },
      composeDisclaimer: () => '',
    },
    '@react-pdf/renderer': {
      renderToBuffer: async () => {
        if (fail) throw Error('Expected fixture render failure')
        return Buffer.from('PDF')
      },
    },
    '@/utilities/getURL': { getServerSideURL: () => 'http://fixture.invalid' },
  })
  const body = {
    ...base,
    name: 'Test Buyer',
    phone: 'test',
    projectSlug: 'fixture',
    selectedUnitKey: 'unit-1',
    dpMode: 'auto',
    installments: [{ kind: 'Monthly', active: true, locked: false, valuePerPeriod: 141666.67 }],
  }
  const request = (body) => ({ json: async () => body, headers: new Headers() })
  assert.equal((await POST(request(body))).status, 200)
  assert.equal(captured.plan.totals.downPayment, engine.computePlan(body).totals.downPayment)
  assert.equal((await POST(request({ ...body, dpMode: 'fixed', downPaymentPct: 80 }))).status, 400)
  assert.equal((await POST(request(null))).status, 400)
  writes = 0
  fail = true
  assert.equal((await POST(request(body))).status, 500)
  assert.equal(writes, 0)
})
