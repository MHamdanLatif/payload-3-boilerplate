// Iteration 15 — per-unit Builder Default Payment Plan.
// Adds:
//   1. Two columns on featured_projects_unit_types for downPaymentPct + possessionPct
//   2. A new array sub-table for the installments[] sub-collection
//   3. An enum for the installment frequency
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
  // ─── 1. Two columns on featured_projects_unit_types ─────────────
  `ALTER TABLE "featured_projects_unit_types"
     ADD COLUMN IF NOT EXISTS "default_plan_down_payment_pct" numeric;`,
  `ALTER TABLE "featured_projects_unit_types"
     ADD COLUMN IF NOT EXISTS "default_plan_possession_pct" numeric;`,

  // ─── 2. Enum: default installment frequency ─────────────────────
  `DO $$ BEGIN
     CREATE TYPE "enum_featured_projects_unit_types_default_plan_installments_frequency" AS ENUM
       ('Monthly', 'Quarterly', 'HalfYearly');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ─── 3. Array sub-table for defaultPlan.installments ─────────────
  // Naming follows Payload's convention: <collection>_<parent_field_path>.
  // Parent rows are themselves in the featured_projects_unit_types array,
  // so the FK points at THAT table's `id` column (not featured_projects).
  `CREATE TABLE IF NOT EXISTS "featured_projects_unit_types_default_plan_installments" (
     "_order" integer NOT NULL,
     "_parent_id" varchar NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "frequency" "enum_featured_projects_unit_types_default_plan_installments_frequency" NOT NULL,
     "amount" numeric NOT NULL,
     "locked" boolean DEFAULT true
   );`,

  `DO $$ BEGIN
     ALTER TABLE "featured_projects_unit_types_default_plan_installments"
       ADD CONSTRAINT "featured_projects_unit_types_default_plan_installments_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."featured_projects_unit_types"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  `CREATE INDEX IF NOT EXISTS "featured_projects_unit_types_default_plan_installments_order_idx"
     ON "featured_projects_unit_types_default_plan_installments" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "featured_projects_unit_types_default_plan_installments_parent_id_idx"
     ON "featured_projects_unit_types_default_plan_installments" USING btree ("_parent_id");`,
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
