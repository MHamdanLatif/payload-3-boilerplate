// Iteration-13 schema:
//   1. featured_projects_unit_types += `loan_amount` numeric
//   2. featured_projects_payment_plan_payment_heads table (array sub-collection)
//   3. enum for paymentHeads.category
// Idempotent. Safe to re-run.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=')
    if (i === -1) return acc
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    acc[k] = v
    return acc
  }, {})

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })

const stmts = [
  // 1. Loan amount on unit rows
  `ALTER TABLE "featured_projects_unit_types" ADD COLUMN IF NOT EXISTS "loan_amount" numeric;`,

  // 2. Category enum for payment heads
  `DO $$ BEGIN
     CREATE TYPE "enum_featured_projects_payment_plan_payment_heads_category" AS ENUM
       ('Initial Payment', 'Time-Based', 'Grey Structure', 'Finishing', 'Possession');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // 3. Payment-heads array sub-table
  `CREATE TABLE IF NOT EXISTS "featured_projects_payment_plan_payment_heads" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "name" varchar NOT NULL,
     "category" "enum_featured_projects_payment_plan_payment_heads_category" NOT NULL,
     "enabled" boolean DEFAULT true,
     "is_custom" boolean DEFAULT false
   );`,

  `DO $$ BEGIN
     ALTER TABLE "featured_projects_payment_plan_payment_heads"
       ADD CONSTRAINT "featured_projects_payment_plan_payment_heads_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."featured_projects"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  `CREATE INDEX IF NOT EXISTS "featured_projects_payment_plan_payment_heads_order_idx"
     ON "featured_projects_payment_plan_payment_heads" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "featured_projects_payment_plan_payment_heads_parent_id_idx"
     ON "featured_projects_payment_plan_payment_heads" USING btree ("_parent_id");`,

  // 4. PaymentPlanLeads — new columns for v2 capture
  `ALTER TABLE "payment_plan_leads" ADD COLUMN IF NOT EXISTS "loan_included" boolean DEFAULT false;`,
  `ALTER TABLE "payment_plan_leads" ADD COLUMN IF NOT EXISTS "loan_amount" numeric;`,
  `ALTER TABLE "payment_plan_leads" ADD COLUMN IF NOT EXISTS "engine_version" varchar DEFAULT 'v1';`,
]

await client.connect()
for (const s of stmts) {
  try {
    await client.query(s)
    console.log('ok')
  } catch (e) {
    console.warn('skip:', e.message.slice(0, 200))
  }
}
await client.end()
console.log('done.')
