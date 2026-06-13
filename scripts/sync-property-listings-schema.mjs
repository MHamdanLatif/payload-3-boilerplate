// One-shot DB sync for PropertyListings iteration-5 fields + propertyType
// enum extension. Idempotent — every statement uses IF (NOT) EXISTS / DO blocks.
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
  // Extend propertyType enums on BOTH collections to include Office + Shop.
  `ALTER TYPE "enum_property_listings_property_type" ADD VALUE IF NOT EXISTS 'Office';`,
  `ALTER TYPE "enum_property_listings_property_type" ADD VALUE IF NOT EXISTS 'Shop';`,
  `ALTER TYPE "enum_featured_projects_property_type" ADD VALUE IF NOT EXISTS 'Office';`,
  `ALTER TYPE "enum_featured_projects_property_type" ADD VALUE IF NOT EXISTS 'Shop';`,

  // PropertyListings new scalar columns
  `ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "society_name" varchar;`,
  `ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "summary" varchar;`,
  `ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "walkthrough_video_url" varchar;`,
  `ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "google_maps_embed_url" varchar;`,
  `ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "meta_title" varchar;`,
  `ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "meta_description" varchar;`,
  `ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "meta_image_id" integer;`,

  // SEO image FK
  `DO $$ BEGIN
    ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_meta_image_id_fk"
      FOREIGN KEY ("meta_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "property_listings_meta_image_idx" ON "property_listings" ("meta_image_id");`,

  // Array table: amenities
  `CREATE TABLE IF NOT EXISTS "property_listings_amenities" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL
  );`,
  `DO $$ BEGIN
    ALTER TABLE "property_listings_amenities" ADD CONSTRAINT "property_listings_amenities_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "property_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "pl_amenities_order_idx" ON "property_listings_amenities" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pl_amenities_parent_idx" ON "property_listings_amenities" ("_parent_id");`,

  // Array table: additionalImages
  `CREATE TABLE IF NOT EXISTS "property_listings_additional_images" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "image_id" integer NOT NULL,
    "caption" varchar
  );`,
  `DO $$ BEGIN
    ALTER TABLE "property_listings_additional_images" ADD CONSTRAINT "property_listings_additional_images_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "property_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE "property_listings_additional_images" ADD CONSTRAINT "property_listings_additional_images_image_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "pl_additional_images_order_idx" ON "property_listings_additional_images" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pl_additional_images_parent_idx" ON "property_listings_additional_images" ("_parent_id");`,
]

await client.connect()
for (const s of stmts) {
  try {
    await client.query(s)
    console.log('ok')
  } catch (e) {
    console.warn('skip:', e.message.slice(0, 120))
  }
}
await client.end()
console.log('done.')
