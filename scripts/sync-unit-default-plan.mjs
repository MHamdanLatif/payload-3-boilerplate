// Iteration 15 — per-unit Builder Default Payment Plan.
// Adds:
//   1. Two columns on featured_projects_unit_types for downPaymentPct + possessionPct
//   2. A new array sub-table for the installments[] sub-collection.
//      Table name is overridden via Payload's `dbName` to `fp_unit_default_inst`
//      because the auto-generated name exceeds Postgres's 63-char identifier limit.
// Idempotent. Safe to re-run.
//
// The first block drops the LEGACY long-named table + enum from earlier
// iterations of this script — that initial DROP-IF-EXISTS run is harmless when
// the legacy names never existed.
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
  // ─── 0. Cleanup: drop the legacy long-named artifacts ───────────
  `DROP TABLE IF EXISTS "featured_projects_unit_types_default_plan_installments" CASCADE;`,
  `DROP TYPE IF EXISTS "enum_featured_projects_unit_types_default_plan_installments_frequency";`,

  // ─── 1. Two columns on featured_projects_unit_types ─────────────
  `ALTER TABLE "featured_projects_unit_types"
     ADD COLUMN IF NOT EXISTS "default_plan_down_payment_pct" numeric;`,
  `ALTER TABLE "featured_projects_unit_types"
     ADD COLUMN IF NOT EXISTS "default_plan_possession_pct" numeric;`,

  // ─── 2. Enum for default-installment frequency (short name) ─────
  `DO $$ BEGIN
     CREATE TYPE "enum_fp_unit_default_inst_frequency" AS ENUM
       ('Monthly', 'Quarterly', 'HalfYearly');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ─── 3. Array sub-table for defaultPlan.installments ─────────────
  // Table name `fp_unit_default_inst` matches the `dbName` set on the
  // Payload field; _parent_id is varchar because the parent row is itself
  // in an array (featured_projects_unit_types.id is varchar).
  `CREATE TABLE IF NOT EXISTS "fp_unit_default_inst" (
     "_order" integer NOT NULL,
     "_parent_id" varchar NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "frequency" "enum_fp_unit_default_inst_frequency" NOT NULL,
     "amount" numeric NOT NULL,
     "locked" boolean DEFAULT true
   );`,

  `DO $$ BEGIN
     ALTER TABLE "fp_unit_default_inst"
       ADD CONSTRAINT "fp_unit_default_inst_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."featured_projects_unit_types"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  `CREATE INDEX IF NOT EXISTS "fp_unit_default_inst_order_idx"
     ON "fp_unit_default_inst" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "fp_unit_default_inst_parent_id_idx"
     ON "fp_unit_default_inst" USING btree ("_parent_id");`,
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
