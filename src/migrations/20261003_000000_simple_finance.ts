import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE finance_deals ADD COLUMN IF NOT EXISTS other_property varchar;
    ALTER TABLE finance_deals ADD COLUMN IF NOT EXISTS unit_type_key varchar;
    ALTER TABLE finance_deals ADD COLUMN IF NOT EXISTS expected_payment_date timestamptz;
    ALTER TABLE finance_deals ALTER COLUMN calculation_type SET DEFAULT 'fixed';
    ALTER TABLE finance_deals ALTER COLUMN trigger SET DEFAULT 'booking';
    ALTER TABLE finance_deals ALTER COLUMN project_id DROP NOT NULL;
    ALTER TABLE finance_deals ALTER COLUMN unit_number DROP NOT NULL;
    ALTER TABLE finance_receipts ADD COLUMN IF NOT EXISTS next_expected_date timestamptz;
    ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS deal_id integer REFERENCES finance_deals(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS finance_expenses_deal_idx ON finance_expenses(deal_id);
    CREATE INDEX IF NOT EXISTS finance_deals_expected_payment_date_idx ON finance_deals(expected_payment_date);
    UPDATE finance_deals SET fixed_commission=ROUND(sale_value * COALESCE(commission_rate,0)/100,2), calculation_type='fixed' WHERE calculation_type='percentage';
    UPDATE finance_deals d SET expected_payment_date=COALESCE(
      (SELECT MIN(s.date) FROM finance_receivables s WHERE s.deal_id=d.id AND NOT COALESCE(s.voided,false)
        AND s.amount > COALESCE((SELECT SUM(r.amount) FROM finance_receipts r WHERE r.receivable_id=s.id AND NOT COALESCE(r.voided,false)),0)),
      d.expected_eligibility_date
    ) WHERE expected_payment_date IS NULL;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Financial records are preserved. Restore from a reviewed backup to roll back.')
}
