/**
 * DDL for the `marketed-projects` collection and its lead-side columns.
 *
 * Shared by the committed migration and by
 * `scripts/sync-marketed-projects-schema.mjs`, which is what actually applies it
 * to production — Railway runs no migrations, so schema changes go on by hand
 * before the code deploy. Defined once so the two cannot drift.
 *
 * Every statement is idempotent; re-running is a no-op.
 *
 * Two naming hazards are handled here:
 *   1. Postgres truncates identifiers at 63 characters, which is why the
 *      installments and payment-heads arrays carry `dbName` overrides in the
 *      collection and appear as `mp_unit_default_inst` / `mp_payment_heads`.
 *   2. Index names are global per schema, so every index is `mp_` prefixed and
 *      cannot collide with the existing `fp_*` names.
 */

const LOCATIONS = [
  'Gulshan-e-Iqbal', 'Gulistan-e-Johar', 'Scheme 33', 'DHA', 'Clifton',
  'M.A. Jinnah Road', 'Jinnah Avenue', 'Malir', 'Saddar', 'Korangi',
  'Model Colony', 'Sukkur', 'Other',
]
const UNIT_TYPES = [
  '1 Bed Lounge', '2 Bed Lounge', '2 Bed Drawing', '2 Bed DD / 3 Bed Lounge',
  '3 Bed Lounge', '3 Bed Drawing', '4 Bed Drawing', '4+ Rooms',
]
const quoted = (values: readonly string[]): string =>
  values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')

export const MARKETED_PROJECTS_DDL: string[] = [
  // ── 1. Enums ──────────────────────────────────────────────────────────────
  `DO $$ BEGIN CREATE TYPE "enum_marketed_projects_location" AS ENUM (${quoted(LOCATIONS)});
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum_marketed_projects_status" AS ENUM ('Pre-launch','Under Construction');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum_marketed_projects_project_type" AS ENUM ('Mixed-use','Residential Tower','Plot Community');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum_marketed_projects_unit_types_type" AS ENUM (${quoted(UNIT_TYPES)});
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum_mp_payment_heads_category" AS ENUM ('Initial Payment','Time-Based','Grey Structure','Finishing','Possession');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum_mp_unit_default_inst_frequency" AS ENUM ('Monthly','Quarterly','HalfYearly');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── 2. Parent table ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "marketed_projects" (
     "id" serial PRIMARY KEY NOT NULL,
     "title" varchar NOT NULL,
     "slug" varchar NOT NULL,
     "slug_key" varchar,
     "active" boolean DEFAULT true,
     "linked_project_id" integer,
     "builder_name" varchar NOT NULL,
     "project_type" "enum_marketed_projects_project_type",
     "starting_price" numeric,
     "location" "enum_marketed_projects_location" NOT NULL,
     "status" "enum_marketed_projects_status" NOT NULL,
     "summary" varchar,
     "offer_note" varchar,
     "brochure_id" integer,
     "walkthrough_video_url" varchar,
     "google_maps_embed_url" varchar,
     "payment_plan_enabled" boolean DEFAULT true,
     "payment_plan_price_override" numeric,
     "payment_plan_total_duration_months" numeric NOT NULL DEFAULT 36,
     "payment_plan_down_payment_min_pct" numeric NOT NULL DEFAULT 10,
     "payment_plan_down_payment_max_pct" numeric NOT NULL DEFAULT 30,
     "payment_plan_possession_pct" numeric NOT NULL DEFAULT 5,
     "payment_plan_project_logo_id" integer,
     "payment_plan_plan_disclaimer" varchar,
     "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
     "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "mp_slug_idx" ON "marketed_projects" ("slug");`,
  // The lookup the route actually runs. Unique so `TulipComforts` and
  // `tulip-comforts` cannot exist as two separate pages competing for one URL.
  `CREATE UNIQUE INDEX IF NOT EXISTS "mp_slug_key_idx" ON "marketed_projects" ("slug_key");`,
  `CREATE INDEX IF NOT EXISTS "mp_updated_at_idx" ON "marketed_projects" ("updated_at");`,
  `DO $$ BEGIN ALTER TABLE "marketed_projects" ADD CONSTRAINT "marketed_projects_brochure_id_media_id_fk"
     FOREIGN KEY ("brochure_id") REFERENCES "media"("id") ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "marketed_projects" ADD CONSTRAINT "marketed_projects_logo_id_media_id_fk"
     FOREIGN KEY ("payment_plan_project_logo_id") REFERENCES "media"("id") ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "marketed_projects" ADD CONSTRAINT "marketed_projects_linked_project_id_fk"
     FOREIGN KEY ("linked_project_id") REFERENCES "featured_projects"("id") ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── 3. Array tables ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "marketed_projects_elevation_images" (
     "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
     "image_id" integer NOT NULL, "caption" varchar
   );`,
  `CREATE TABLE IF NOT EXISTS "marketed_projects_photo_gallery" (
     "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
     "image_id" integer NOT NULL, "caption" varchar
   );`,
  `CREATE TABLE IF NOT EXISTS "marketed_projects_builder_track_record" (
     "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
     "name" varchar, "image_id" integer, "location" varchar, "detail" varchar,
     "completed_year" varchar, "status_line" varchar, "is_current" boolean DEFAULT false
   );`,
  `CREATE TABLE IF NOT EXISTS "marketed_projects_unit_types" (
     "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
     "name" varchar,
     "type" "enum_marketed_projects_unit_types_type" NOT NULL,
     "flat_layout_id" integer,
     "is_duplex" boolean DEFAULT false,
     "rooms" numeric NOT NULL,
     "price" numeric NOT NULL,
     "area_sq_ft" numeric,
     "loan_amount" numeric,
     "default_plan_down_payment_pct" numeric,
     "default_plan_possession_pct" numeric
   );`,
  `CREATE TABLE IF NOT EXISTS "mp_payment_heads" (
     "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
     "name" varchar NOT NULL,
     "category" "enum_mp_payment_heads_category" NOT NULL,
     "enabled" boolean DEFAULT true,
     "is_custom" boolean DEFAULT false,
     "number_of_slabs" numeric
   );`,
  // Grandchild: its parent is a row in an array table, whose primary key is a
  // varchar — so `_parent_id` is varchar here, not integer.
  `CREATE TABLE IF NOT EXISTS "mp_unit_default_inst" (
     "_order" integer NOT NULL, "_parent_id" varchar NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
     "frequency" "enum_mp_unit_default_inst_frequency" NOT NULL,
     "amount" numeric NOT NULL,
     "locked" boolean DEFAULT true
   );`,

  // ── 4. Indexes (all mp_ prefixed — index names are schema-global) ──────────
  ...[
    ['mp_elevation_images', 'marketed_projects_elevation_images'],
    ['mp_photo_gallery', 'marketed_projects_photo_gallery'],
    ['mp_track_record', 'marketed_projects_builder_track_record'],
    ['mp_unit_types', 'marketed_projects_unit_types'],
    ['mp_payment_heads', 'mp_payment_heads'],
    ['mp_unit_default_inst', 'mp_unit_default_inst'],
  ].flatMap(([prefix, table]) => [
    `CREATE INDEX IF NOT EXISTS "${prefix}_order_idx" ON "${table}" ("_order");`,
    `CREATE INDEX IF NOT EXISTS "${prefix}_parent_idx" ON "${table}" ("_parent_id");`,
  ]),
  `CREATE INDEX IF NOT EXISTS "mp_elevation_images_image_idx" ON "marketed_projects_elevation_images" ("image_id");`,
  `CREATE INDEX IF NOT EXISTS "mp_photo_gallery_image_idx" ON "marketed_projects_photo_gallery" ("image_id");`,
  `CREATE INDEX IF NOT EXISTS "mp_track_record_image_idx" ON "marketed_projects_builder_track_record" ("image_id");`,
  `CREATE INDEX IF NOT EXISTS "mp_unit_types_layout_idx" ON "marketed_projects_unit_types" ("flat_layout_id");`,

  // ── 5. Foreign keys for the array tables ──────────────────────────────────
  ...[
    ['marketed_projects_elevation_images', 'mp_elev_parent_fk'],
    ['marketed_projects_photo_gallery', 'mp_gallery_parent_fk'],
    ['marketed_projects_builder_track_record', 'mp_track_parent_fk'],
    ['marketed_projects_unit_types', 'mp_unit_parent_fk'],
    ['mp_payment_heads', 'mp_heads_parent_fk'],
  ].map(
    (pair) => `DO $$ BEGIN ALTER TABLE "${pair[0]}" ADD CONSTRAINT "${pair[1]}"
       FOREIGN KEY ("_parent_id") REFERENCES "marketed_projects"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  ),
  `DO $$ BEGIN ALTER TABLE "mp_unit_default_inst" ADD CONSTRAINT "mp_inst_parent_fk"
     FOREIGN KEY ("_parent_id") REFERENCES "marketed_projects_unit_types"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  ...[
    ['marketed_projects_elevation_images', 'image_id', 'mp_elev_image_fk'],
    ['marketed_projects_photo_gallery', 'image_id', 'mp_gallery_image_fk'],
    ['marketed_projects_builder_track_record', 'image_id', 'mp_track_image_fk'],
    ['marketed_projects_unit_types', 'flat_layout_id', 'mp_unit_layout_fk'],
  ].map(
    (t) => `DO $$ BEGIN ALTER TABLE "${t[0]}" ADD CONSTRAINT "${t[2]}"
       FOREIGN KEY ("${t[1]}") REFERENCES "media"("id") ON DELETE SET NULL;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  ),

  // ── 6. Lead-side columns ──────────────────────────────────────────────────
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "interested_unit_type" varchar;`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "marketed_project_id" integer;`,
  `CREATE INDEX IF NOT EXISTS "leads_marketed_project_idx" ON "leads" ("marketed_project_id");`,
  `DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_marketed_project_id_fk"
     FOREIGN KEY ("marketed_project_id") REFERENCES "marketed_projects"("id") ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `ALTER TABLE "payment_plan_leads" ADD COLUMN IF NOT EXISTS "marketed_project_id" integer;`,
  `CREATE INDEX IF NOT EXISTS "ppl_marketed_project_idx" ON "payment_plan_leads" ("marketed_project_id");`,
  `DO $$ BEGIN ALTER TABLE "payment_plan_leads" ADD CONSTRAINT "ppl_marketed_project_id_fk"
     FOREIGN KEY ("marketed_project_id") REFERENCES "marketed_projects"("id") ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

// The two new conversion-surface values run OUTSIDE the transaction and one at
// a time: Postgres refuses to reference a newly added enum value in the same
// transaction that added it.
export const MARKETED_PROJECTS_ENUM_DDL: string[] = [
  `ALTER TYPE "enum_leads_conversion_surface" ADD VALUE IF NOT EXISTS 'marketed-hero-form';`,
  `ALTER TYPE "enum_leads_conversion_surface" ADD VALUE IF NOT EXISTS 'marketed-cta-form';`,
  // Added later: the payment-plan PDF gate now writes a real lead row, where
  // before it only wrote to payment-plan-leads and Privyr.
  `ALTER TYPE "enum_leads_conversion_surface" ADD VALUE IF NOT EXISTS 'payment-plan-pdf';`,
]

