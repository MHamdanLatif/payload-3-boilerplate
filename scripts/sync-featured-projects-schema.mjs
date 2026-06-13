// One-shot DB sync for FeaturedProjects new fields. Idempotent.
// Run after extending the collection schema to apply column/table changes
// without going through Payload's interactive dev-mode rename prompts.
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
  // Enum for unit type
  `DO $$ BEGIN
    CREATE TYPE "enum_featured_projects_unit_types_type" AS ENUM (
      '1 Bed Lounge','2 Bed Lounge','2 Bed Drawing','3 Bed Lounge','3 Bed Drawing','4 Bed Drawing','4+ Beds'
    );
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // Enum for _status (drafts)
  `DO $$ BEGIN
    CREATE TYPE "enum_featured_projects_status_versions" AS ENUM ('draft','published');
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "enum__featured_projects_v_version_status" AS ENUM ('draft','published');
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // FeaturedProjects main table — new columns
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "summary" varchar;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "night_elevation_id" integer;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "brochure_id" integer;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "google_maps_embed_url" varchar;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "meta_title" varchar;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "meta_description" varchar;`,
  `ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "meta_image_id" integer;`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects" ADD COLUMN "_status" "enum_featured_projects_status_versions" DEFAULT 'draft';
  EXCEPTION WHEN duplicate_column THEN null; END $$;`,

  // FKs for media uploads (set null on delete)
  `DO $$ BEGIN
    ALTER TABLE "featured_projects" ADD CONSTRAINT "featured_projects_night_elevation_id_fk"
      FOREIGN KEY ("night_elevation_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects" ADD CONSTRAINT "featured_projects_brochure_id_fk"
      FOREIGN KEY ("brochure_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects" ADD CONSTRAINT "featured_projects_meta_image_id_fk"
      FOREIGN KEY ("meta_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS "featured_projects_night_elevation_idx" ON "featured_projects" ("night_elevation_id");`,
  `CREATE INDEX IF NOT EXISTS "featured_projects_brochure_idx" ON "featured_projects" ("brochure_id");`,
  `CREATE INDEX IF NOT EXISTS "featured_projects_meta_image_idx" ON "featured_projects" ("meta_image_id");`,
  `CREATE INDEX IF NOT EXISTS "featured_projects_status_idx" ON "featured_projects" ("_status");`,

  // Array table: elevationImages
  `CREATE TABLE IF NOT EXISTS "featured_projects_elevation_images" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "image_id" integer NOT NULL,
    "caption" varchar
  );`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects_elevation_images" ADD CONSTRAINT "featured_projects_elevation_images_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "featured_projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects_elevation_images" ADD CONSTRAINT "featured_projects_elevation_images_image_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "fp_elevation_images_order_idx" ON "featured_projects_elevation_images" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "fp_elevation_images_parent_idx" ON "featured_projects_elevation_images" ("_parent_id");`,

  // Array table: photoGallery
  `CREATE TABLE IF NOT EXISTS "featured_projects_photo_gallery" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "image_id" integer NOT NULL,
    "caption" varchar
  );`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects_photo_gallery" ADD CONSTRAINT "featured_projects_photo_gallery_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "featured_projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects_photo_gallery" ADD CONSTRAINT "featured_projects_photo_gallery_image_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "fp_photo_gallery_order_idx" ON "featured_projects_photo_gallery" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "fp_photo_gallery_parent_idx" ON "featured_projects_photo_gallery" ("_parent_id");`,

  // Array table: unitTypes
  `CREATE TABLE IF NOT EXISTS "featured_projects_unit_types" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "type" "enum_featured_projects_unit_types_type" NOT NULL,
    "beds" numeric NOT NULL,
    "price" numeric NOT NULL,
    "area_sq_ft" numeric
  );`,
  `DO $$ BEGIN
    ALTER TABLE "featured_projects_unit_types" ADD CONSTRAINT "featured_projects_unit_types_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "featured_projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "fp_unit_types_order_idx" ON "featured_projects_unit_types" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "fp_unit_types_parent_idx" ON "featured_projects_unit_types" ("_parent_id");`,
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
