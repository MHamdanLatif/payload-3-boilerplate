import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import crypto from 'node:crypto'

function load(file, deps = {}, globals = {}) {
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
    ...globals,
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
  // New schedules use the current timing: six half-yearly payments (months 6 … 36) fit the
  // 36-month window, so the calculated monthly head matches the builder's 125,000.
  assert.equal(input.cadence, 2)
  assert.equal(p.plan.rows.filter((r) => r.kind === 'installment-halfyearly').length, 6)
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
    renders = 0,
    finished = 0,
    storedRevision = {},
    captured
  const project = {
    id: 1,
    title: 'Fixture',
    builderName: 'Builder',
    unitTypes: [{ id: 'unit-1', type: '2 Bed Lounge', loanAmount: 1000000 }],
  }
  const { POST } = load('src/app/api/admin/payment-plan/pdf/route.ts', {
    payload: {
      getPayload: async () => ({
        auth: async () => ({ user }),
        findByID: async () => {
          reads++
          return project
        },
        find: async ({ collection, where }) => {
          assert.equal(collection, 'schedule-revisions')
          const [schedule, revision] = where.and.map((w) => Object.values(w)[0].equals)
          return { docs: schedule === 5 && revision === 2 ? [storedRevision] : [] }
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
    '@/lib/payment-plan-layout': {
      loadUnitLayout: async () => null,
      finishSchedulePDF: async (buffer) => {
        finished++
        return new Uint8Array(buffer)
      },
    },
    '@/components/projects/PaymentPlanPDF': {
      PaymentPlanDocument: (p) => {
        captured = p
        return p
      },
      composeDisclaimer: () => '',
    },
    '@/utilities/getURL': { getServerSideURL: () => 'http://fixture.invalid' },
  })
  const req = (plan, extra = {}) => ({
    text: async () => JSON.stringify({ plan, ...extra }),
    headers: new Headers(),
  })
  assert.equal((await POST(req(custom))).status, 401)
  user = { id: 1, collection: 'customers' }
  assert.equal((await POST(req(custom))).status, 401)
  assert.equal(reads, 0)
  user = { id: 1, collection: 'users' }
  assert.equal((await POST(req({ ...custom, basePrice: 1 }))).status, 400)
  assert.equal((await POST(req(custom, { note: 'Private revision note' }))).status, 200)
  assert.equal(renders, 1)
  // Revision notes are internal: nothing from the request note reaches the client PDF.
  assert.ok(!JSON.stringify(captured).includes('Private revision note'))
  assert.ok(!('note' in captured))
  // react-pdf numbering is replaced by numbering the merged file.
  assert.equal(captured.pageNumbers, false)
  assert.equal(finished, 1)
  assert.equal(captured.loanIncluded, false)
  // A forged loan amount is replaced by the CMS unit's loan.
  assert.equal((await POST(req({ ...custom, includeLoan: true, loanAmount: 1 }))).status, 200)
  assert.equal(captured.loanAmount, 1000000)
  assert.equal(captured.loanOnDemand, true)
  assert.equal(captured.plan.totals.effectivePrice, 9000000)
  assert.equal(sum(captured.plan.rows), 9000000)
  // Saved with loan X (1,000,000); the CMS loan later changes to Y. The saved revision still
  // exports and totals with X, even if the client sends a different plan alongside it.
  storedRevision.settings = { ...custom, includeLoan: true, loanAmount: 1000000 }
  project.unitTypes[0].loanAmount = 1500000
  const savedRevision = { scheduleId: 5, revision: 2 }
  assert.equal((await POST(req({ ...custom, basePrice: 1 }, { savedRevision }))).status, 200)
  assert.equal(captured.loanAmount, 1000000)
  assert.equal(captured.plan.totals.effectivePrice, 9000000)
  assert.ok(captured.priceBreakdown.some((l) => l.amount === -1000000))
  assert.equal(admin.computeAdminPlan(storedRevision.settings).loanAmount, 1000000)
  assert.equal(
    (await POST(req(custom, { savedRevision: { scheduleId: 5, revision: 9 } }))).status,
    404,
  )
  assert.equal((await POST(req(custom, { savedRevision: { scheduleId: 'x' } }))).status, 400)
  // An unsaved Studio plan takes today's CMS loan (Y).
  assert.equal((await POST(req({ ...custom, includeLoan: true, loanAmount: 1000000 }))).status, 200)
  assert.equal(captured.loanAmount, 1500000)
  project.unitTypes[0].loanAmount = null
  assert.equal((await POST(req({ ...custom, includeLoan: true, loanAmount: 1 }))).status, 400)
})

test('public PDF uses Auto DP, rejects guardrail bypasses, renders before recording leads', async () => {
  let externalRequests = 0
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
    '@/lib/project-visibility': { hasPublicPaymentPlan: () => true },
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
      availableUnits: (p) => (p.unitTypes ?? []).filter((u) => !u.soldOut),
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
  }, {
    process: { env: { PRIVYR_WEBHOOK_URL: 'https://legacy-crm.invalid' } },
    fetch: async () => { externalRequests++; return new Response(null, { status: 200 }) },
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
  const marketedResponse = await POST(request({ ...body, projectCollection: 'marketed-projects' }))
  assert.equal(marketedResponse.status, 400)
  assert.equal((await marketedResponse.json()).error, 'Payment plans are not available for marketed projects')
  assert.equal(writes, 0, 'Retired marketed calculators must not create payment-plan leads')
  assert.equal((await POST(request(body))).status, 200)
  assert.equal(writes, 2, 'PDF enquiries persist in both CRM and payment-plan audit')
  assert.equal(externalRequests, 0, 'Old Privyr settings must not forward PDF leads')
  assert.equal(captured.plan.totals.downPayment, engine.computePlan(body).totals.downPayment)
  assert.equal((await POST(request({ ...body, dpMode: 'fixed', downPaymentPct: 80 }))).status, 400)
  assert.equal((await POST(request(null))).status, 400)
  writes = 0
  fail = true
  assert.equal((await POST(request(body))).status, 500)
  assert.equal(writes, 0)
})

test('settings saved without the timing marker keep the original cadence rule', () => {
  const input = {
    ...custom, duration: 60, installmentStartMonth: 2,
    charges: [{ id: 'parking', name: 'Parking', amount: 500000, separate: true, month: 90 }],
    heads: [...custom.heads,
      ...[3, 6, 12].map((intervalMonths) => ({ ...custom.heads[1], id: `cadence-${intervalMonths}`, intervalMonths, method: 'entered', amount: 1000 })),
      { ...custom.heads[0], id: 'milestone', kind: 'milestone', name: 'Roof', firstMonth: 20, amount: 1000 },
    ],
  }
  const plan = admin.computeAdminPlan(input).plan
  const monthly = plan.rows.filter((r) => r.sourceId === 'monthly')
  assert.equal(monthly.length, 60)
  assert.equal(monthly[0].monthOffset, 2)
  assert.equal(monthly.at(-1).monthOffset, 61)
  for (const [interval, count, last] of [[3, 19, 59], [6, 9, 56], [12, 4, 50]]) {
    const payments = plan.rows.filter((r) => r.sourceId === `cadence-${interval}`)
    assert.equal(payments[0].monthOffset, 2 + interval)
    assert.equal(payments.length, count)
    assert.equal(payments.at(-1).monthOffset, last)
  }
  assert.equal(plan.rows.at(-1).kind, 'possession')
  assert.equal(plan.rows.at(-1).label, 'At possession')
  assert.equal(plan.rows.find((r) => r.sourceId === 'milestone').label, 'On milestone completion')
  assert.equal(plan.rows.find((r) => r.kind === 'extra-charge').label, 'Month 90')
  assert.equal(sum(plan.rows), 10500000)
  assert.ok(!plan.warnings.length)
  const shifted = admin.computeAdminPlan({ ...input, installmentStartMonth: 8 }).plan
  assert.equal(shifted.rows.filter((r) => r.sourceId === 'monthly').length, 60)
  assert.equal(shifted.rows.find((r) => r.sourceId === 'monthly').monthOffset, 8)
})

test('current cadence puts quarterly, half-yearly and yearly payments at the end of each period', () => {
  // The owner's example: start 3, duration 60.
  const input = {
    ...custom, duration: 60, installmentStartMonth: 3, cadence: 2,
    heads: [...custom.heads,
      ...[3, 6, 12].map((intervalMonths) => ({ ...custom.heads[1], id: `cadence-${intervalMonths}`, intervalMonths, method: 'entered', amount: 1000 })),
    ],
  }
  assert.equal(admin.validateAdminPlan(input).length, 0)
  const plan = admin.computeAdminPlan(input).plan
  const months = (id) => [...plan.rows.filter((r) => r.sourceId === id).map((r) => r.monthOffset)]
  assert.deepEqual(months('monthly'), Array.from({ length: 60 }, (_, i) => 3 + i))
  assert.deepEqual(months('cadence-3'), Array.from({ length: 20 }, (_, i) => 5 + 3 * i))
  assert.deepEqual(months('cadence-6'), Array.from({ length: 10 }, (_, i) => 8 + 6 * i))
  assert.deepEqual(months('cadence-12'), [14, 26, 38, 50, 62])
  assert.equal(plan.rows.at(-1).kind, 'possession')
  assert.equal(sum(plan.rows), 10000000)
  // The same settings without the marker render exactly as they did when sent.
  const legacy = admin.computeAdminPlan({ ...input, cadence: undefined }).plan
  assert.equal(legacy.rows.filter((r) => r.sourceId === 'cadence-3').length, 19)
  assert.equal(legacy.rows.filter((r) => r.sourceId === 'cadence-6').length, 9)
  assert.equal(legacy.rows.filter((r) => r.sourceId === 'cadence-12').length, 4)
  assert.equal(legacy.rows.find((r) => r.sourceId === 'cadence-3').monthOffset, 6)
  assert.ok(admin.validateAdminPlan({ ...input, cadence: 3 }).length)
  assert.equal(admin.withCurrentCadence(custom).cadence, 2)
  assert.equal(custom.cadence, undefined)
})

test('a CMS loan is held outside the schedule and shown in the breakdown', () => {
  const input = admin.withUnitLoan({ ...custom, includeLoan: true, loanAmount: 1 }, 2000000)
  assert.equal(input.loanAmount, 2000000)
  const result = admin.computeAdminPlan(input)
  assert.equal(result.finalPrice, 10000000)
  assert.equal(result.loanAmount, 2000000)
  assert.equal(result.scheduledPrice, 8000000)
  assert.equal(result.remaining, 0)
  assert.equal(sum(result.plan.rows), 8000000)
  assert.equal(result.plan.rows.at(-1).cumulativePct, 100)
  assert.deepEqual([...result.breakdown.slice(-3).map((l) => l.amount)], [10000000, -2000000, 8000000])
  // Off by default, and a plan without a loan looks exactly as before.
  const plain = admin.computeAdminPlan(custom)
  assert.equal(plain.loanAmount, 0)
  assert.equal(plain.breakdown.at(-1).label, 'Final payable price')
  assert.equal(admin.withUnitLoan({ ...custom, loanAmount: 5 }, 2000000).loanAmount, undefined)
  // A unit without a CMS loan cannot schedule one.
  assert.ok(admin.computeAdminPlan(admin.withUnitLoan({ ...custom, includeLoan: true }, null)).plan.warnings.length)
  assert.ok(admin.validateAdminPlan({ ...custom, includeLoan: 'yes' }).length)
})

test('summary rows read in month order with consistent cumulative values', () => {
  const input = { ...custom, duration: 24, installmentStartMonth: 1, cadence: 2,
    heads: [custom.heads[0],
      { ...custom.heads[1], id: 'quarterly', name: 'Quarterly', intervalMonths: 3, method: 'entered', amount: 100000 },
      { ...custom.heads[1], id: 'monthly' },
      { ...custom.heads[0], id: 'dp2', name: 'Second down payment', firstMonth: 2, amount: 500000 },
      custom.heads[2]],
  }
  const full = admin.computeAdminPlan(input).plan
  const summary = admin.summarizeAdminPlan(full)
  const offsets = [...summary.rows.map((r) => r.monthOffset)]
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b))
  assert.deepEqual([...summary.rows.map((r) => r.headName.split('\n')[0])],
    ['Down payment', 'Monthly', 'Second down payment', 'Quarterly', 'Possession'])
  let running = 0
  for (const row of summary.rows) {
    running = Math.round((running + row.amount) * 100) / 100
    assert.equal(row.cumulativeAmount, running)
  }
  assert.equal(summary.rows.at(-1).cumulativePct, 100)
})

test('schedule saves map conflicts to 409, missing records to 404 and hide database errors', async () => {
  let fail = null
  let created = 0
  const logged = []
  const project = { id: 1, unitTypes: [{ id: 'unit-1', loanAmount: 0 }] }
  const { POST } = load('src/app/api/crm/leads/[id]/schedules/route.ts', {
    'next/server': { NextResponse: { json: (data, options) =>
      new Response(JSON.stringify(data), { status: options?.status ?? 200 }) } },
    'node:util': { isDeepStrictEqual: () => false },
    payload: {
      createLocalReq: async () => ({}),
      getPayload: async () => ({
        auth: async () => ({ user: { id: 1, collection: 'users' } }),
        findByID: async ({ collection, id }) => {
          if (collection === 'leads' && String(id) !== '7') throw Error('Not Found')
          return collection === 'leads' ? { id: 7 } : project
        },
        find: async () => ({ docs: [] }),
        create: async ({ collection }) => {
          if (collection === 'schedule-revisions' && fail) throw fail
          created++
          return { id: 3 }
        },
        db: {
          beginTransaction: async () => 'tx',
          commitTransaction: async () => {},
          rollbackTransaction: async () => {},
        },
      }),
    },
    '@payload-config': {},
    '@/lib/admin-payment-plan': admin,
    '@/utilities/getURL': { getServerSideURL: () => 'http://fixture.invalid' },
  }, { URL, console: { error: (...args) => logged.push(args) } })
  const body = {
    plan: custom,
    buyer: { name: 'Client', phone: '0300' },
    title: 'Option A',
    note: '',
    entryKey: '00000000-0000-4000-8000-000000000000',
    expectedRevision: 0,
  }
  const call = async (id, data = body) => {
    const response = await POST(
      {
        url: `http://fixture.invalid/api/crm/leads/${id}/schedules`,
        text: async () => JSON.stringify(data),
        headers: new Headers({ origin: 'http://fixture.invalid' }),
      },
      { params: Promise.resolve({ id }) },
    )
    return { status: response.status, error: (await response.json()).error }
  }
  assert.equal((await call('7')).status, 200)
  assert.equal((await call('8')).status, 404)
  assert.equal((await call('7', { ...body, plan: { ...custom, unitId: 'gone' } })).status, 404)
  fail = Object.assign(Error('ValidationError'), { data: { errors: [{ path: 'revisionKey' }] } })
  assert.deepEqual(await call('7'), {
    status: 409,
    error: 'Someone saved a newer version of this schedule – reload to see it.',
  })
  fail = Error('relation "schedule_revisions" violates something secret')
  const failure = await call('7')
  assert.equal(failure.status, 500)
  assert.ok(!failure.error.includes('secret'))
  assert.equal(logged.length, 1)
  assert.ok(created >= 1)
})

test('summary retains down-payment dates, extra charge dates, milestones and exact installment rounding', () => {
  const input = { ...custom, installmentStartMonth: 4,
    heads: custom.heads.map((h) => h.kind === 'down-payment' ? { ...h, count: 2, amount: 1000000, intervalMonths: 2 } : h),
    charges: [{ id: 'parking', name: 'Parking', amount: 500000, separate: true, month: 6 }],
  }
  const full = admin.computeAdminPlan(input).plan
  const summary = admin.summarizeAdminPlan(full)
  assert.equal(sum(summary.rows), sum(full.rows))
  assert.equal(summary.rows.filter((r) => r.kind.startsWith('installment-')).length, 1)
  const installments = summary.rows.find((r) => r.kind.startsWith('installment-'))
  assert.match(installments.headName, /x 12/)
  assert.match(installments.headName, /x 24/)
  assert.equal(installments.label, 'Months 4-39')
  assert.equal(summary.rows.filter((r) => r.kind === 'down-payment').map((r) => r.label).join('|'), 'At signing|Month 2')
  assert.equal(summary.rows.find((r) => r.kind === 'extra-charge').label, 'Month 6')
  assert.equal(summary.rows.at(-1).kind, 'possession')
  assert.equal(summary.rows.at(-1).cumulativePct, 100)
  assert.ok(engine.DEFAULT_DISCLAIMER.includes('Documentation charges for utility connections will be payable extra'))
})

test('yearly cadence and invalid duration/start controls are validated using derived timing', () => {
  const yearly = { ...custom, installmentStartMonth: 2, duration: 60,
    heads: custom.heads.map((h) => h.kind === 'installment' ? { ...h, intervalMonths: 12 } : h) }
  assert.equal(admin.validateAdminPlan(yearly).length, 0)
  assert.ok(admin.computeAdminPlan(yearly).plan.rows.some((r) => r.kind === 'installment-yearly'))
  assert.ok(admin.validateAdminPlan({ ...yearly, duration: 6 }).length)
  assert.ok(admin.validateAdminPlan({ ...yearly, installmentStartMonth: -1 }).length)
  assert.ok(admin.validateAdminPlan({ ...yearly, installmentStartMonth: NaN }).length)
})

test('lead capture saves to native CRM only and reports persistence failures', async () => {
  let fail = false
  let saved
  let externalRequests = 0
  let conversions = 0
  const { handleLeadCapture } = load('src/lib/lead-capture.ts', {
    'next/server': { NextResponse: { json: (data, options) =>
      new Response(JSON.stringify(data), { status: options?.status ?? 200 }) } },
    crypto,
    payload: { getPayload: async () => ({ create: async (input) => {
      if (fail) throw Error('Expected CRM write failure')
      saved = input
      return { id: 1 }
    } }) },
    '@payload-config': {},
    'libphonenumber-js': { isValidPhoneNumber: () => true },
    '@/lib/meta-capi': { sendCapiEvent: async () => { conversions++ } },
    '@/lib/attribution': {
      ATTRIBUTION_COOKIE: 'attribution', CONVERSION_SURFACES: ['project-hero-form'],
      acquisitionSourceFromTouch: () => 'direct', parseAttribution: () => null,
    },
  }, {
    process: { env: { PRIVYR_WEBHOOK_URL: 'https://legacy-crm.invalid' } },
    fetch: async () => { externalRequests++; return new Response(null, { status: 200 }) },
    setTimeout, clearTimeout, AbortController,
  })
  const request = () => new Request('https://site.invalid/api/lead-capture', {
    method: 'POST', body: JSON.stringify({ name: 'Buyer', phone: '+923001234567',
      sourceKind: 'project', sourceSlug: 'saima-elite-enclave',
      interestedUnitType: 'Type 2B1', conversionSurface: 'project-hero-form' }),
  })
  const response = await handleLeadCapture(request())
  assert.equal(response.status, 200)
  assert.ok((await response.json()).eventId)
  assert.equal(saved.collection, 'leads')
  assert.equal(saved.data.sourceSlug, 'saima-elite-enclave')
  assert.equal(saved.data.interestedUnitType, 'Type 2B1')
  assert.equal(conversions, 1)
  fail = true
  assert.equal((await handleLeadCapture(request())).status, 502)
  assert.equal(conversions, 1, 'Failed capture must not report a conversion')
  assert.equal(externalRequests, 0, 'Old Privyr settings must not forward enquiries')
})
