import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS finance_access boolean DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS finance_admin boolean DEFAULT false;
    UPDATE users SET finance_access = true, finance_admin = true
      WHERE id = (SELECT min(id) FROM users) AND NOT EXISTS (SELECT 1 FROM users WHERE finance_admin = true);
    DO $$ BEGIN CREATE TYPE enum_finance_deals_calculation_type AS ENUM ('percentage', 'fixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE enum_finance_deals_trigger AS ENUM ('threshold', 'booking', 'milestone', 'manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS finance_deals (
      id serial PRIMARY KEY, lead_id integer REFERENCES leads(id) ON DELETE SET NULL,
      client_name varchar NOT NULL, contact varchar, project_id integer NOT NULL REFERENCES featured_projects(id) ON DELETE RESTRICT,
      unit_number varchar NOT NULL, unit_type varchar, configuration varchar, size_sqft numeric,
      date_closed timestamptz NOT NULL, sale_value numeric NOT NULL CHECK (sale_value >= 0), booking_amount numeric,
      booking_percentage numeric NOT NULL DEFAULT 0 CHECK (booking_percentage BETWEEN 0 AND 100),
      required_booking_percentage numeric DEFAULT 20 CHECK (required_booking_percentage BETWEEN 0 AND 100),
      expected_eligibility_date timestamptz, salesperson_id integer REFERENCES users(id) ON DELETE SET NULL,
      calculation_type enum_finance_deals_calculation_type NOT NULL DEFAULT 'percentage', commission_rate numeric CHECK (commission_rate BETWEEN 0 AND 100), fixed_commission numeric CHECK (fixed_commission >= 0),
      trigger enum_finance_deals_trigger NOT NULL DEFAULT 'threshold', milestone_description varchar,
      milestone_reached boolean DEFAULT false, claimed boolean DEFAULT false, cancelled boolean DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS finance_receivables (
      id serial PRIMARY KEY, deal_id integer NOT NULL REFERENCES finance_deals(id) ON DELETE RESTRICT,
      date timestamptz NOT NULL, amount numeric NOT NULL CHECK (amount >= 0), voided boolean DEFAULT false, void_reason varchar
    );
    CREATE TABLE IF NOT EXISTS finance_receipts (
      id serial PRIMARY KEY, deal_id integer NOT NULL REFERENCES finance_deals(id) ON DELETE RESTRICT,
      receivable_id integer REFERENCES finance_receivables(id) ON DELETE RESTRICT,
      date timestamptz NOT NULL, amount numeric NOT NULL CHECK (amount >= 0), payment_method varchar, reference varchar,
      received_from varchar, voided boolean DEFAULT false, void_reason varchar
    );
    CREATE TABLE IF NOT EXISTS finance_expenses (
      id serial PRIMARY KEY, date timestamptz NOT NULL, amount numeric NOT NULL CHECK (amount >= 0), category varchar NOT NULL DEFAULT 'Miscellaneous',
      project_id integer REFERENCES featured_projects(id) ON DELETE RESTRICT, description varchar NOT NULL,
      payment_method varchar, vendor varchar, recurring boolean DEFAULT false, voided boolean DEFAULT false, void_reason varchar
    );
  `)
  for (const table of [
    'finance_deals',
    'finance_receipts',
    'finance_receivables',
    'finance_expenses',
  ]) {
    await payload.db.drizzle.execute(
      sql.raw(`
      ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS notes varchar;
      ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS entry_key varchar;
      ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_by_id integer REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_by_id integer REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
      ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
      CREATE UNIQUE INDEX IF NOT EXISTS ${table}_entry_key_idx ON ${table}(entry_key);
      CREATE INDEX IF NOT EXISTS ${table}_created_at_idx ON ${table}(created_at);
      CREATE INDEX IF NOT EXISTS ${table}_updated_at_idx ON ${table}(updated_at);
      ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS ${table}_id integer REFERENCES ${table}(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_${table}_id_idx ON payload_locked_documents_rels(${table}_id);
    `),
    )
  }
  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS finance_deals_project_idx ON finance_deals(project_id);
    CREATE INDEX IF NOT EXISTS finance_deals_date_closed_idx ON finance_deals(date_closed);
    CREATE INDEX IF NOT EXISTS finance_receipts_deal_idx ON finance_receipts(deal_id);
    CREATE INDEX IF NOT EXISTS finance_receipts_receivable_idx ON finance_receipts(receivable_id);
    CREATE INDEX IF NOT EXISTS finance_receipts_date_idx ON finance_receipts(date);
    CREATE INDEX IF NOT EXISTS finance_receivables_deal_idx ON finance_receivables(deal_id);
    CREATE INDEX IF NOT EXISTS finance_receivables_date_idx ON finance_receivables(date);
    CREATE INDEX IF NOT EXISTS finance_expenses_date_idx ON finance_expenses(date);
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'Finance rollback is intentionally manual: back up and retain financial records before removing the schema.',
  )
}
