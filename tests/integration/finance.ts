import assert from 'node:assert/strict'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../../src/payload.config'
import { financeCTE } from '../../src/lib/finance-query'
import { up } from '../../src/migrations/20261002_000000_finance'

const url = new URL(process.env.DATABASE_URI || '')
assert.ok(
  ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_e2e'),
  'Use a disposable localhost _e2e database.',
)
const payload = await getPayload({ config })
const rollback = new Error('rollback finance validation')
try {
  await payload.db.drizzle.transaction(async (tx) => {
    await tx.execute(sql`CREATE SCHEMA finance_validation; SET LOCAL search_path TO finance_validation;
      CREATE TABLE users(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES;
      CREATE TABLE leads(id serial PRIMARY KEY);
      CREATE TABLE featured_projects(id serial PRIMARY KEY,title varchar); INSERT INTO featured_projects(title) VALUES('Finance test');
      CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY);`)
    const args = { payload: { db: { drizzle: tx } } } as unknown as Parameters<typeof up>[0]
    await up(args)
    await up(args)
    const admins = await tx.execute(sql`SELECT id FROM users WHERE finance_admin=true`)
    assert.deepEqual(
      admins.rows.map((r) => r.id),
      [1],
      'Migration grants only the oldest existing user and is repeatable',
    )
    await tx.execute(sql`INSERT INTO finance_deals(client_name,project_id,unit_number,date_closed,sale_value,booking_percentage,required_booking_percentage,commission_rate,trigger)
      VALUES('Client',1,'101','2026-09-10 00:00:00+05',20000000,10,20,2,'threshold')`)
    const deal = async () =>
      (
        await tx.execute(
          sql`${financeCTE} SELECT commission,eligible,conditional,received,outstanding,status FROM deals WHERE id=1`,
        )
      ).rows[0] as Record<string, any>
    let d = await deal()
    assert.equal(Number(d.commission), 400000)
    assert.equal(Number(d.eligible), 0)
    assert.equal(Number(d.conditional), 400000)
    assert.equal(Number(d.outstanding), 0)
    await tx.execute(sql`UPDATE finance_deals SET booking_percentage=20 WHERE id=1`)
    d = await deal()
    assert.equal(Number(d.outstanding), 400000)
    await tx.execute(
      sql`INSERT INTO finance_receivables(deal_id,date,amount) VALUES(1,'2020-09-15',200000),(1,'2020-10-15',200000)`,
    )
    let schedules = (
      await tx.execute(sql`${financeCTE} SELECT id,unpaid,status FROM schedules ORDER BY id`)
    ).rows
    assert.equal(schedules[0].status, 'Overdue')
    await tx.execute(
      sql`INSERT INTO finance_receipts(deal_id,date,amount) VALUES(1,'2026-10-05 00:00:00+05',150000)`,
    )
    d = await deal()
    assert.equal(Number(d.received), 150000)
    assert.equal(Number(d.outstanding), 250000)
    schedules = (await tx.execute(sql`${financeCTE} SELECT id,unpaid FROM schedules ORDER BY id`))
      .rows
    assert.deepEqual(
      schedules.map((s) => Number(s.unpaid)),
      [50000, 200000],
      'Unmatched cash allocates oldest first',
    )
    await tx.execute(
      sql`INSERT INTO finance_receipts(deal_id,receivable_id,date,amount) VALUES(1,2,'2026-10-10 00:00:00+05',200000),(1,NULL,'2026-10-10 00:00:00+05',50000)`,
    )
    d = await deal()
    assert.equal(Number(d.received), 400000)
    assert.equal(Number(d.outstanding), 0)
    assert.equal(d.status, 'Fully Received')
    schedules = (await tx.execute(sql`${financeCTE} SELECT id,unpaid FROM schedules ORDER BY id`))
      .rows
    assert.deepEqual(
      schedules.map((s) => Number(s.unpaid)),
      [0, 0],
    )
    await tx.execute(
      sql`INSERT INTO finance_expenses(date,amount,category,description) VALUES('2026-10-12 00:00:00+05',100000,'Meta Ads','Campaign')`,
    )
    const months = (
      await tx.execute(sql`${financeCTE} SELECT
      (SELECT SUM(commission) FROM deals WHERE to_char(date_closed AT TIME ZONE 'Asia/Karachi','YYYY-MM')='2026-09') AS september_generated,
      (SELECT SUM(amount) FROM finance_receipts WHERE to_char(date AT TIME ZONE 'Asia/Karachi','YYYY-MM')='2026-10') -
      (SELECT SUM(amount) FROM finance_expenses WHERE to_char(date AT TIME ZONE 'Asia/Karachi','YYYY-MM')='2026-10') AS october_net`)
    ).rows[0]
    assert.equal(Number(months.september_generated), 400000)
    assert.equal(Number(months.october_net), 300000)
    await tx.execute(
      sql`UPDATE finance_receipts SET voided=true,void_reason='Correction' WHERE id=1`,
    )
    d = await deal()
    assert.equal(Number(d.received), 250000)
    assert.equal(Number(d.outstanding), 150000)
    await tx.execute(
      sql`UPDATE finance_deals SET calculation_type='fixed',fixed_commission=300000,trigger='manual',milestone_reached=false WHERE id=1`,
    )
    d = await deal()
    assert.equal(Number(d.commission), 300000)
    assert.equal(Number(d.eligible), 0)
    await tx.execute(sql`UPDATE finance_deals SET milestone_reached=true WHERE id=1`)
    d = await deal()
    assert.equal(Number(d.outstanding), 50000)
    await tx.execute(sql`UPDATE finance_deals SET cancelled=true WHERE id=1`)
    d = await deal()
    assert.equal(Number(d.outstanding), 0)
    assert.equal(d.status, 'Cancelled')
    assert.equal(Number(d.received), 250000)
    await tx.execute(sql`INSERT INTO finance_deals(client_name,project_id,unit_number,date_closed,sale_value,calculation_type,fixed_commission,trigger)
      VALUES('Receipt before schedule',1,'102','2026-10-01',10000000,'fixed',250000,'booking');
      INSERT INTO finance_receipts(deal_id,date,amount,created_at) VALUES(2,'2026-10-01',50000,'2026-10-01');
      INSERT INTO finance_receivables(deal_id,date,amount,created_at) VALUES(2,'2026-11-01',200000,'2026-10-02');`)
    let future = (await tx.execute(sql`${financeCTE} SELECT unpaid FROM schedules WHERE deal_id=2`))
      .rows[0]
    assert.equal(
      Number(future.unpaid),
      200000,
      'Cash received before a new schedule must not reduce that future expectation twice',
    )
    await tx.execute(
      sql`INSERT INTO finance_receipts(deal_id,date,amount,created_at) VALUES(2,'2026-10-03',50000,'2026-10-03')`,
    )
    future = (await tx.execute(sql`${financeCTE} SELECT unpaid FROM schedules WHERE deal_id=2`))
      .rows[0]
    assert.equal(Number(future.unpaid), 150000)
    console.log(
      'Finance migration and PostgreSQL calculation scenarios A–G, allocation, fixed/manual triggers, voids and cancellation passed.',
    )
    throw rollback
  })
} catch (error) {
  if (error !== rollback) throw error
} finally {
  await payload.destroy()
}
