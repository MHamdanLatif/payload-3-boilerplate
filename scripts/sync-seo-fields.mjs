// One-shot DB sync for iteration-7 SEO fields:
// - addressLine on both collections
// - faqs array tables on both collections
// Idempotent — every statement uses IF (NOT) EXISTS.
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
  // --- Scalar columns ---
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "address_line" varchar;`,
  `ALTER TABLE "property_listings"  ADD COLUMN IF NOT EXISTS "address_line" varchar;`,

  // --- FAQs table: featured_projects ---
  `CREATE TABLE IF NOT EXISTS "featured_projects_faqs" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "question" varchar NOT NULL,
     "answer" varchar NOT NULL
   );`,
  `DO $$ BEGIN
     ALTER TABLE "featured_projects_faqs"
       ADD CONSTRAINT "featured_projects_faqs_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."featured_projects"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "featured_projects_faqs_order_idx"
     ON "featured_projects_faqs" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "featured_projects_faqs_parent_id_idx"
     ON "featured_projects_faqs" USING btree ("_parent_id");`,

  // --- FAQs table: property_listings ---
  `CREATE TABLE IF NOT EXISTS "property_listings_faqs" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "question" varchar NOT NULL,
     "answer" varchar NOT NULL
   );`,
  `DO $$ BEGIN
     ALTER TABLE "property_listings_faqs"
       ADD CONSTRAINT "property_listings_faqs_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."property_listings"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "property_listings_faqs_order_idx"
     ON "property_listings_faqs" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "property_listings_faqs_parent_id_idx"
     ON "property_listings_faqs" USING btree ("_parent_id");`,
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
