// One-shot DB sync for iteration-9 Blogs.seoInternalLinks array sub-table.
// Idempotent — every statement uses IF (NOT) EXISTS or guarded DO blocks.
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
  // --- Enum: seoInternalLinks link_type ---
  `DO $$ BEGIN
     CREATE TYPE "enum_blogs_seo_internal_links_link_type" AS ENUM ('project', 'location', 'index');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // --- Array sub-table for blogs.seoInternalLinks ---
  `CREATE TABLE IF NOT EXISTS "blogs_seo_internal_links" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "anchor_text" varchar NOT NULL,
     "link_type" "enum_blogs_seo_internal_links_link_type" NOT NULL DEFAULT 'project',
     "target_project_id" integer,
     "target_location_slug" varchar,
     "injected" boolean DEFAULT false
   );`,

  // --- FK to parent blogs row ---
  `DO $$ BEGIN
     ALTER TABLE "blogs_seo_internal_links" ADD CONSTRAINT "blogs_seo_internal_links_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."blogs"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // --- FK to target featured-project (nullable, ON DELETE SET NULL) ---
  `DO $$ BEGIN
     ALTER TABLE "blogs_seo_internal_links" ADD CONSTRAINT "blogs_seo_internal_links_target_project_id_fk"
       FOREIGN KEY ("target_project_id") REFERENCES "public"."featured_projects"("id")
       ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  `CREATE INDEX IF NOT EXISTS "blogs_seo_internal_links_order_idx" ON "blogs_seo_internal_links" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "blogs_seo_internal_links_parent_id_idx" ON "blogs_seo_internal_links" USING btree ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "blogs_seo_internal_links_target_project_id_idx" ON "blogs_seo_internal_links" USING btree ("target_project_id");`,

  // --- Optional placementWarnings field on the generated_by group ---
  `ALTER TABLE "blogs" ADD COLUMN IF NOT EXISTS "generated_by_placement_warnings" varchar;`,
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
