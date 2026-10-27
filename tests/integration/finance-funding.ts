// Database acceptance test for project funding, advertising allocation and commission
// distribution. Runs the real collection hooks and ledger queries through Payload's local
// API as a finance user. Requires a disposable localhost database ending in _e2e whose
// schema is current (e.g. after `payload run tests/e2e/setup-db.ts`). It writes test rows.
//   DATABASE_URI=postgres://…@127.0.0.1:54329/x_e2e corepack pnpm payload run tests/integration/finance-funding.ts
import assert from 'node:assert/strict'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../../src/payload.config'
import {
  accountBalances,
  cashPurpose,
  dealPosition,
  projectPosition,
  type Exec,
} from '../../src/lib/finance-ledger'

const url = new URL(process.env.DATABASE_URI || '')
assert.ok(
  ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_e2e'),
  'Use a disposable localhost _e2e database.',
)
const payload = await getPayload({ config })
const exec: Exec = async (q) => (await payload.db.drizzle.execute(q)).rows as Record<string, any>[]
const rs = (pkr: number) => Math.round(pkr * 100)
let step = ''
const check = async (name: string, fn: () => Promise<void>) => {
  step = name
  await fn()
  console.log('✔', name)
}

const user = await payload.create({
  collection: 'users',
  data: { email: `finance-${Date.now()}@example.com`, password: 'Finance-test-1!', name: 'Finance tester', financeAccess: true, financeAdmin: true } as never,
  overrideAccess: true,
})
const as = { user: { ...user, collection: 'users' } as never, overrideAccess: false } as const
const create = async (collection: string, data: Record<string, unknown>) =>
  (await payload.create({ collection: collection as never, data: data as never, ...as })) as Record<string, any>
const update = async (collection: string, id: number, data: Record<string, unknown>) =>
  (await payload.update({ collection: collection as never, id, data: data as never, ...as })) as Record<string, any>
const project = async (title: string) =>
  Number(
    (
      await exec(sql`INSERT INTO featured_projects(title, builder_name, property_type, location, status)
        VALUES (${title}, 'Test Builder', 'Flat', 'Scheme 33', 'Pre-launch') RETURNING id`)
    )[0].id,
  )
const day = (d: string) => `${d}T00:00:00+05:00`

try {
  const me = await create('finance-participants', { name: 'Me', isOwner: true })
  const a = await create('finance-participants', { name: 'Investor A' })
  const b = await create('finance-participants', { name: 'Participant B' })
  const bank = await create('finance-accounts', { name: 'Business bank', kind: 'bank', openingBalance: 100000, openingDate: day('2026-10-01') })
  const card = await create('finance-accounts', { name: 'Business card', kind: 'card', cardLabel: 'Visa 1234', openingBalance: 0, openingDate: day('2026-10-01') })
  const pA = await project('Funding Test A')
  const pB = await project('Funding Test B')
  const pC = await project('Funding Test C')
  const rulesA = await create('finance-project-rules', {
    project: pA,
    funding: [
      { participant: a.id, percent: 50 },
      { participant: me.id, percent: 25 },
      { participant: b.id, percent: 25 },
    ],
    commission: [
      { participant: me.id, percent: 60 },
      { participant: a.id, percent: 40 },
    ],
  })
  await create('finance-project-rules', { project: pB, funding: [{ participant: me.id, percent: 100 }] })
  await create('finance-project-rules', {
    project: pC,
    funding: [
      { participant: a.id, percent: 50 },
      { participant: b.id, percent: 50 },
    ],
  })
  const campaign = async (p: number, name: string) =>
    create('finance-campaigns', { project: p, name, startAt: '2026-10-01T09:00:00+05:00', dailyBudget: 5000 })
  const cA = await campaign(pA, 'A launch')
  const cB = await campaign(pB, 'B launch')
  const cC = await campaign(pC, 'C launch')

  await check('rule tables must total 100%', async () => {
    const bad = await project('Bad split')
    await assert.rejects(
      () => create('finance-project-rules', { project: bad, funding: [{ participant: a.id, percent: 90 }] }),
      /must total 100%/,
    )
  })

  let charge1: Record<string, any> = {}
  await check('proportional charge allocation: 10,000 + 20,000 Meta, 32,400 debit', async () => {
    charge1 = await create('finance-ad-charges', {
      date: '2026-10-05T12:00:00+05:00',
      account: bank.id,
      bankDebit: 32400,
      metaReference: 'META-1',
      lines: [
        { campaign: cA.id, metaAmount: 10000 },
        { campaign: cB.id, metaAmount: 20000 },
      ],
    })
    assert.equal(charge1.additionalTotal, 2400)
    assert.deepEqual(
      charge1.lines.map((l: any) => [l.additionalCharges, l.totalCost]),
      [
        [800, 10800],
        [1600, 21600],
      ],
    )
  })

  await check('participant cost allocation: 10,800 at 50/25/25', async () => {
    const shares = charge1.shares.filter((s: any) => (s.project?.id ?? s.project) === pA)
    assert.deepEqual(
      shares.map((s: any) => s.amount),
      [5400, 2700, 2700],
    )
    const [row] = await exec(sql`SELECT SUM(amount) AS t FROM finance_ad_charges_shares WHERE _parent_id=${charge1.id}`)
    assert.equal(Number(row.t), 32400, 'shares reconcile exactly to the bank debit')
  })

  await check('a duplicate Meta reference is flagged, not silently accepted', async () => {
    const dup = await create('finance-ad-charges', {
      date: '2026-10-05T12:00:00+05:00',
      account: bank.id,
      bankDebit: 100,
      metaReference: 'meta-1',
      lines: [{ campaign: cB.id, metaAmount: 100 }],
    })
    assert.match(dup.reviewFlags, /already uses the reference/)
    await update('finance-ad-charges', dup.id, { voided: true, voidReason: 'Test duplicate' })
  })

  await check('investor shortfall: 10,000 cash, A +15,000 entitlement, B -5,000 shortfall', async () => {
    for (const [who, amount] of [
      [a, 75000],
      [b, 75000],
    ] as const)
      await create('finance-funding', { kind: 'contribution', participant: who.id, project: pC, amount, date: day('2026-10-02'), account: bank.id })
    await create('finance-ad-charges', {
      date: '2026-10-06T12:00:00+05:00',
      account: bank.id,
      bankDebit: 160000,
      lines: [{ campaign: cC.id, metaAmount: 160000 }],
    })
    await create('finance-funding', { kind: 'contribution', participant: a.id, project: pC, amount: 20000, date: day('2026-10-07'), account: bank.id })
    const pos = await projectPosition(exec, pC)
    const by = (p: Record<string, any>) => pos.participants.find((x) => x.key === String(p.id))!
    assert.equal(pos.poolPaisa, rs(10000))
    assert.equal(by(a).balancePaisa, rs(15000))
    assert.equal(by(b).balancePaisa, rs(-5000))
    assert.equal(by(b).shortfall, true)
    assert.equal(by(a).costPaisa, rs(80000), 'A is charged exactly its 50%, not B\'s shortfall')
    assert.equal(by(b).costPaisa, rs(80000))
    assert.equal(by(a).backedPaisa, rs(10000), 'only 10,000 of A\'s entitlement is backed by cash')
    await assert.rejects(
      () => create('finance-funding', { kind: 'refund', participant: a.id, project: pC, amount: 10000.01, date: day('2026-10-08'), account: bank.id }),
      /cash-backed balance/,
    )
  })

  await check('project isolation: A\'s deficit is not covered by B\'s money in the shared account', async () => {
    const posA = await projectPosition(exec, pA)
    assert.equal(posA.poolPaisa, rs(-10800), 'project A spent 10,800 with no funding')
    assert.equal(posA.deficitPaisa, rs(10800))
    await create('finance-funding', { kind: 'contribution', participant: me.id, project: pB, amount: 50000, date: day('2026-10-03'), account: bank.id })
    const posB = await projectPosition(exec, pB)
    assert.equal(posB.poolPaisa, rs(50000 - 21600))
    assert.equal((await projectPosition(exec, pA)).deficitPaisa, rs(10800), 'unchanged by B\'s funding')
    await assert.rejects(
      () => create('finance-funding', { kind: 'refund', participant: a.id, project: pA, amount: 1, date: day('2026-10-08'), account: bank.id }),
      /cannot use other projects/,
    )
  })

  let deal: Record<string, any> = {}
  await check('partial commission receipts: deduction applied once, 120/80 then 270/180', async () => {
    deal = await create('finance-deals', {
      clientName: 'Acceptance buyer',
      project: pA,
      unitType: '2 Bed',
      dateClosed: day('2026-10-10'),
      saleValue: 25000000,
      fixedCommission: 500000,
      expectedPaymentDate: day('2026-11-01'),
      commissionMode: 'custom',
      commissionSplit: [
        { participant: me.id, percent: 60 },
        { participant: a.id, percent: 40 },
      ],
    })
    await create('finance-expenses', {
      deal: deal.id,
      date: day('2026-10-11'),
      amount: 50000,
      category: 'Broker fee',
      description: 'External broker',
      vendor: 'Broker Co',
      preDistribution: true,
      paymentStatus: 'paid',
      account: bank.id,
    })
    await assert.rejects(
      () =>
        create('finance-expenses', {
          deal: deal.id,
          date: day('2026-10-11'),
          amount: 1,
          category: 'Meta Ads',
          description: 'Ads',
          preDistribution: true,
          paymentStatus: 'paid',
          account: bank.id,
        }),
      /Advertising is never deducted/,
    )
    await create('finance-receipts', { deal: deal.id, date: day('2026-10-15'), amount: 250000, nextExpectedDate: day('2026-12-01'), account: bank.id })
    let pos = (await dealPosition(exec, deal.id))!
    assert.equal(pos.distributablePaisa, rs(200000))
    assert.deepEqual(
      pos.recipients.map((r) => r.entitlementPaisa),
      [rs(120000), rs(80000)],
    )
    await create('finance-receipts', { deal: deal.id, date: day('2026-12-01'), amount: 250000, account: bank.id })
    pos = (await dealPosition(exec, deal.id))!
    assert.equal(pos.distributablePaisa, rs(450000), 'the 50,000 deduction is not applied twice')
    assert.deepEqual(
      pos.recipients.map((r) => r.entitlementPaisa),
      [rs(270000), rs(180000)],
    )
  })

  await check('advertising stays separate: project A ad spend does not reduce commission', async () => {
    const [ads] = await exec(sql`SELECT SUM(total_cost) AS t FROM finance_ad_charges_lines WHERE project_id=${pA}`)
    assert.ok(Number(ads.t) > 0, 'project A has advertising spend')
    assert.equal((await dealPosition(exec, deal.id))!.deductionPaisa, rs(50000), 'only the broker fee is deducted')
  })

  let payout: Record<string, any> = {}
  await check('payouts: limited to unpaid entitlement; my withdrawal reduces business cash once', async () => {
    const pos = (await dealPosition(exec, deal.id))!
    const mine = pos.recipients[0]
    const before = Number((await accountBalances(exec)).find((x) => x.id === bank.id)!.balance)
    payout = await create('finance-payouts', {
      deal: deal.id,
      recipientKey: mine.key,
      amount: 270000,
      date: day('2026-12-02'),
      account: bank.id,
      paymentMethod: 'Bank transfer',
      reference: 'To personal account',
    })
    const after = Number((await accountBalances(exec)).find((x) => x.id === bank.id)!.balance)
    assert.equal(before - after, rs(270000))
    await assert.rejects(
      () =>
        create('finance-payouts', { deal: deal.id, recipientKey: mine.key, amount: 0.01, date: day('2026-12-02'), account: bank.id, paymentMethod: 'x', reference: 'y' }),
      /unpaid commission/,
    )
    const pos2 = (await dealPosition(exec, deal.id))!
    assert.equal(pos2.recipients[0].unpaidPaisa, 0)
    assert.equal(pos2.recipients[1].unpaidPaisa, rs(180000), 'an entitlement is not a payout')
  })

  await check('an expense added after payouts flags an overpayment without rewriting payouts', async () => {
    const late = await create('finance-expenses', {
      deal: deal.id,
      date: day('2026-12-03'),
      amount: 10000,
      category: 'Broker fee',
      description: 'Late fee',
      vendor: 'Broker Co',
      preDistribution: true,
      paymentStatus: 'unpaid',
    })
    const pos = (await dealPosition(exec, deal.id))!
    assert.equal(pos.overpaidPaisa, rs(6000), "60% of the late 10,000 was already paid to me")
    assert.equal(pos.unpaidReservePaisa, rs(10000), 'reserved but unpaid')
    const [{ n }] = await exec(sql`SELECT COUNT(*)::int AS n FROM finance_payouts WHERE deal_id=${deal.id} AND NOT voided`)
    assert.equal(n, 1)
    await update('finance-expenses', late.id, { voided: true, voidReason: 'Test reversal' })
  })

  await check('historical rules: changing percentages leaves posted charges and saved splits alone', async () => {
    await assert.rejects(
      () => update('finance-project-rules', rulesA.id, { funding: [{ participant: a.id, percent: 100 }] }),
      /reason/,
    )
    await update('finance-project-rules', rulesA.id, {
      funding: [{ participant: a.id, percent: 100 }],
      commission: [{ participant: a.id, percent: 100 }],
      changeReason: 'New agreement from November',
    })
    const [old] = await exec(sql`SELECT string_agg(amount::text, ',' ORDER BY _order) AS a FROM finance_ad_charges_shares WHERE _parent_id=${charge1.id} AND project_id=${pA}`)
    assert.deepEqual(String(old.a).split(',').map(Number), [5400, 2700, 2700])
    const pos = (await dealPosition(exec, deal.id))!
    assert.deepEqual(
      pos.recipients.map((r) => r.units / 10000),
      [60, 40],
    )
    const next = await create('finance-ad-charges', { date: '2026-11-02T10:00:00+05:00', account: bank.id, bankDebit: 1000, lines: [{ campaign: cA.id, metaAmount: 1000 }] })
    assert.deepEqual(
      next.shares.map((s: any) => s.amount),
      [1000],
    )
    const [log] = await exec(sql`SELECT reason FROM finance_audit_log WHERE target_collection='finance-project-rules' AND target_id=${String(rulesA.id)} AND operation='update'`)
    assert.equal(log.reason, 'New agreement from November')
  })

  await check('card charges settle by transfer, counted once as an expense', async () => {
    const before = await cashPurpose(exec)
    await create('finance-ad-charges', { date: '2026-11-03T10:00:00+05:00', account: card.id, bankDebit: 3000, lines: [{ campaign: cB.id, metaAmount: 3000 }] })
    await create('finance-transfers', { date: day('2026-11-20'), fromAccount: bank.id, toAccount: card.id, amount: 3000, kind: 'card-settlement' })
    const after = await cashPurpose(exec)
    assert.equal(before.recordedPaisa - after.recordedPaisa, rs(3000), 'one 3,000 expense, not two')
    assert.equal(Number((await accountBalances(exec)).find((x) => x.id === card.id)!.balance), 0)
  })

  await check('cash integrity: every movement once, purposes reconcile, reversals restore', async () => {
    const purpose = await cashPurpose(exec)
    assert.equal(purpose.differencePaisa, 0, 'cash by purpose adds up to recorded cash')
    const expected =
      100000 + 75000 + 75000 + 20000 + 50000 - 32400 - 160000 - 1000 - 3000 - 50000 + 500000 - 270000
    assert.equal(purpose.recordedPaisa, rs(expected))
    await update('finance-payouts', payout.id, { voided: true, voidReason: 'Test reversal' })
    assert.equal((await cashPurpose(exec)).recordedPaisa, rs(expected + 270000))
    await assert.rejects(() => update('finance-payouts', payout.id, { voided: false }), /cannot be restored/)
    await assert.rejects(() => update('finance-funding', 1, { amount: 1 }), /Posted amount/)
    await assert.rejects(() => payload.delete({ collection: 'finance-funding', id: 1, ...as }), /not allowed|Forbidden/i)
    await assert.rejects(
      () => payload.delete({ collection: 'finance-receipts', where: { deal: { equals: deal.id } }, ...as }).then((r) => {
        if (r.errors.length) throw new Error(r.errors[0].message)
      }),
      /Void it with a reason/,
    )
  })

  await check('double submission: the same entry key cannot post twice', async () => {
    const data = { kind: 'contribution', participant: me.id, project: pB, amount: 10, date: day('2026-11-05'), account: bank.id, entryKey: '11111111-1111-1111-1111-111111111111' }
    await create('finance-funding', data)
    await assert.rejects(() => create('finance-funding', data))
  })

  await check('phone keys: equivalent formats match, a different number does not', async () => {
    const lead = (phone: string, name: string) =>
      payload.create({ collection: 'leads', data: { name, phone, status: 'unqualified' } as never, overrideAccess: true, context: { skipLeadSideEffects: true } })
    const one = await lead('0300-7654321', 'Same Name')
    const two = await lead('+92 300 7654321', 'Other Name')
    const three = await lead('03007654322', 'Same Name')
    assert.equal(one.phoneKey, '+923007654321')
    assert.equal(two.phoneKey, one.phoneKey)
    assert.notEqual(three.phoneKey, one.phoneKey)
  })
  console.log('Finance funding database acceptance tests passed.')
} catch (error) {
  console.error(`✖ ${step}`)
  throw error
} finally {
  await payload.destroy()
}
process.exit(0)
