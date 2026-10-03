import assert from 'node:assert/strict'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../../src/payload.config'
import { financeCTE } from '../../src/lib/finance-query'
import { up as original } from '../../src/migrations/20261002_000000_finance'
import { up } from '../../src/migrations/20261003_000000_simple_finance'

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
      CREATE TABLE users(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES;
      CREATE TABLE leads(id serial PRIMARY KEY);
      CREATE TABLE featured_projects(id serial PRIMARY KEY,title varchar); INSERT INTO featured_projects(title) VALUES('Featured');
      CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY);`)
    await original({ payload: { db: { drizzle: tx } } } as any)
    await tx.execute(sql`INSERT INTO finance_deals(client_name,project_id,unit_number,date_closed,sale_value,booking_percentage,required_booking_percentage,commission_rate,trigger)
      VALUES('Legacy',1,'101','2026-09-10',20000000,10,20,2,'threshold');
      INSERT INTO finance_receivables(deal_id,date,amount) VALUES(1,'2026-10-15',400000);`)
    await up({ db: tx } as any)
    await up({ db: tx } as any)
    const deal = async () =>
      (await tx.execute(sql`${financeCTE} SELECT * FROM deals WHERE id=1`)).rows[0] as Record<
        string,
        any
      >
    let d = await deal()
    assert.equal(
      Number(d.commission),
      400000,
      'Percentage legacy commission preserved as a fixed amount',
    )
    assert.equal(
      Number(d.outstanding),
      400000,
      'Client payment thresholds no longer gate commission',
    )
    assert.ok(d.expected_payment_date, 'Legacy expected date preserved')
    await tx.execute(sql`INSERT INTO finance_receipts(deal_id,date,amount) VALUES(1,'2026-10-05',150000);
      UPDATE finance_deals SET expected_payment_date='2026-11-15' WHERE id=1;`)
    d = await deal()
    assert.equal(Number(d.outstanding), 250000)
    assert.equal(d.status, 'Partially Received')
    const schedule = (
      await tx.execute(
        sql`${financeCTE} SELECT unpaid,to_char(date,'YYYY-MM') AS month FROM schedules WHERE deal_id=1`,
      )
    ).rows[0]
    assert.equal(Number(schedule.unpaid), 250000)
    assert.equal(schedule.month, '2026-11')
    await tx.execute(
      sql`INSERT INTO finance_receipts(deal_id,date,amount) VALUES(1,'2026-11-15',250000)`,
    )
    assert.equal((await deal()).status, 'Fully Received')
    assert.equal((await tx.execute(sql`${financeCTE} SELECT * FROM schedules`)).rows.length, 0)
    await tx.execute(
      sql`UPDATE finance_receipts SET voided=true,void_reason='Correction' WHERE id=1`,
    )
    assert.equal(
      Number((await deal()).outstanding),
      150000,
      'Voiding a receipt restores the balance',
    )
    await tx.execute(sql`UPDATE finance_deals SET cancelled=true WHERE id=1`)
    assert.equal(Number((await deal()).outstanding), 0)
    assert.equal(Number((await deal()).received), 250000, 'Cancellation preserves cash history')
    await tx.execute(sql`INSERT INTO finance_deals(client_name,other_property,unit_type,date_closed,sale_value,fixed_commission,calculation_type,expected_payment_date)
      VALUES('Brokerage buyer','DHA resale','Plot','2026-10-01',10000000,200000,'fixed','2026-11-01');
      INSERT INTO finance_expenses(deal_id,date,amount,category,description) VALUES(2,'2026-10-01',5000,'Travel','Site visit');
      INSERT INTO finance_expenses(date,amount,category,description) VALUES('2026-10-01',1000,'Meta Ads','General campaign');`)
    const other = (await tx.execute(sql`${financeCTE} SELECT * FROM deals WHERE id=2`)).rows[0]
    assert.equal(other.project_name, 'DHA resale')
    assert.equal(Number(other.outstanding), 200000)
    assert.equal(
      Number(
        (await tx.execute(sql`SELECT SUM(amount) AS amount FROM finance_expenses WHERE deal_id=2`))
          .rows[0].amount,
      ),
      5000,
    )
    assert.equal(
      Number(
        (
          await tx.execute(
            sql`SELECT SUM(amount) AS amount FROM finance_expenses WHERE deal_id IS NULL AND project_id IS NULL`,
          )
        ).rows[0].amount,
      ),
      1000,
    )
    throw rollback
  })
} catch (error) {
  if (error !== rollback) throw error
} finally {
  await payload.destroy()
}
console.log(
  'Finance migration, legacy preservation, partial/full/void/cancelled payments and brokerage/expense calculations passed.',
)
