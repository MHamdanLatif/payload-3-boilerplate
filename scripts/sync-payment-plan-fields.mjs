// One-shot DB sync for iteration-12 payment-plan feature.
// Adds the FeaturedProjects.paymentPlan group columns + creates the new
// PaymentPlanLeads collection. Idempotent — re-run is safe.
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
  // ─── Enum: featured_projects.paymentPlan.installmentFrequency ────────────
  `DO $$ BEGIN
     CREATE TYPE "enum_featured_projects_payment_plan_installment_frequency" AS ENUM ('Monthly', 'Quarterly');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ─── featured_projects payment-plan columns ──────────────────────────────
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_enabled" boolean DEFAULT true;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_price_override" numeric;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_total_duration_months" numeric DEFAULT 36;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_down_payment_min_pct" numeric DEFAULT 10;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_down_payment_max_pct" numeric DEFAULT 30;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_possession_pct" numeric DEFAULT 5;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_grey_structure_share_pct" numeric DEFAULT 50;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_installment_frequency" "enum_featured_projects_payment_plan_installment_frequency" DEFAULT 'Monthly';`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_project_logo_id" integer;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "payment_plan_plan_disclaimer" varchar;`,

  `DO $$ BEGIN
     ALTER TABLE "featured_projects" ADD CONSTRAINT "featured_projects_payment_plan_project_logo_fk"
       FOREIGN KEY ("payment_plan_project_logo_id") REFERENCES "public"."media"("id")
       ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ─── Enum: payment_plan_leads.installment_frequency ──────────────────────
  `DO $$ BEGIN
     CREATE TYPE "enum_payment_plan_leads_installment_frequency" AS ENUM ('Monthly', 'Quarterly');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ─── payment_plan_leads collection ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "payment_plan_leads" (
     "id" serial PRIMARY KEY NOT NULL,
     "display_label" varchar,
     "name" varchar NOT NULL,
     "phone" varchar NOT NULL,
     "project_id" integer,
     "project_title_snapshot" varchar,
     "selected_unit_type" varchar,
     "total_price" numeric NOT NULL,
     "down_payment_pct" numeric NOT NULL,
     "down_payment_amount" numeric NOT NULL,
     "possession_pct" numeric NOT NULL,
     "grey_structure_share_pct" numeric NOT NULL,
     "installment_frequency" "enum_payment_plan_leads_installment_frequency" NOT NULL,
     "total_duration_months" numeric NOT NULL,
     "plan_summary" jsonb,
     "user_agent" varchar,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,

  `DO $$ BEGIN
     ALTER TABLE "payment_plan_leads" ADD CONSTRAINT "payment_plan_leads_project_id_fk"
       FOREIGN KEY ("project_id") REFERENCES "public"."featured_projects"("id")
       ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  `CREATE INDEX IF NOT EXISTS "payment_plan_leads_project_id_idx" ON "payment_plan_leads" USING btree ("project_id");`,
  `CREATE INDEX IF NOT EXISTS "payment_plan_leads_created_at_idx" ON "payment_plan_leads" USING btree ("created_at");`,
  `CREATE INDEX IF NOT EXISTS "payment_plan_leads_updated_at_idx" ON "payment_plan_leads" USING btree ("updated_at");`,

  // ─── payload_locked_documents_rels wiring ─────────────────────────────────
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "payment_plan_leads_id" integer;`,
  `DO $$ BEGIN
     ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_plan_leads_fk"
       FOREIGN KEY ("payment_plan_leads_id") REFERENCES "public"."payment_plan_leads"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
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
