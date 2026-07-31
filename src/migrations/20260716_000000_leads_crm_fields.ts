import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Native-CRM fields on `leads`: qualification status, Meta attribution
// (fbclid/fbc/fbp/eventId/ip/ua), brochure link + assets, and delivery logs.
// Idempotent.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_leads_status" AS ENUM('unqualified','contacted','qualified','junk');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "status" "enum_leads_status" DEFAULT 'unqualified' NOT NULL,
      ADD COLUMN IF NOT EXISTS "brochure_id" varchar,
      ADD COLUMN IF NOT EXISTS "event_id" varchar,
      ADD COLUMN IF NOT EXISTS "fbclid" varchar,
      ADD COLUMN IF NOT EXISTS "fbc" varchar,
      ADD COLUMN IF NOT EXISTS "fbp" varchar,
      ADD COLUMN IF NOT EXISTS "client_ip" varchar,
      ADD COLUMN IF NOT EXISTS "user_agent" varchar,
      ADD COLUMN IF NOT EXISTS "meta_ad_name" varchar,
      ADD COLUMN IF NOT EXISTS "brochure_headline" varchar,
      ADD COLUMN IF NOT EXISTS "brochure_pdf_primary_id" integer,
      ADD COLUMN IF NOT EXISTS "brochure_pdf_secondary_id" integer,
      ADD COLUMN IF NOT EXISTS "brochure_map_embed" varchar,
      ADD COLUMN IF NOT EXISTS "brochure_video_url" varchar,
      ADD COLUMN IF NOT EXISTS "owner_notified_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "owner_notify_status" varchar,
      ADD COLUMN IF NOT EXISTS "brochure_sent_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "brochure_send_status" varchar,
      ADD COLUMN IF NOT EXISTS "capi_event_name" varchar,
      ADD COLUMN IF NOT EXISTS "capi_sent_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "capi_status" varchar;

    DO $$ BEGIN
      ALTER TABLE "leads" ADD CONSTRAINT "leads_brochure_pdf_primary_id_media_id_fk"
        FOREIGN KEY ("brochure_pdf_primary_id") REFERENCES "media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "leads" ADD CONSTRAINT "leads_brochure_pdf_secondary_id_media_id_fk"
        FOREIGN KEY ("brochure_pdf_secondary_id") REFERENCES "media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "leads_brochure_id_idx" ON "leads" USING btree ("brochure_id");
    CREATE INDEX IF NOT EXISTS "leads_brochure_pdf_primary_idx" ON "leads" USING btree ("brochure_pdf_primary_id");
    CREATE INDEX IF NOT EXISTS "leads_brochure_pdf_secondary_idx" ON "leads" USING btree ("brochure_pdf_secondary_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "leads"
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "brochure_id",
      DROP COLUMN IF EXISTS "event_id",
      DROP COLUMN IF EXISTS "fbclid",
      DROP COLUMN IF EXISTS "fbc",
      DROP COLUMN IF EXISTS "fbp",
      DROP COLUMN IF EXISTS "client_ip",
      DROP COLUMN IF EXISTS "user_agent",
      DROP COLUMN IF EXISTS "meta_ad_name",
      DROP COLUMN IF EXISTS "brochure_headline",
      DROP COLUMN IF EXISTS "brochure_pdf_primary_id",
      DROP COLUMN IF EXISTS "brochure_pdf_secondary_id",
      DROP COLUMN IF EXISTS "brochure_map_embed",
      DROP COLUMN IF EXISTS "brochure_video_url",
      DROP COLUMN IF EXISTS "owner_notified_at",
      DROP COLUMN IF EXISTS "owner_notify_status",
      DROP COLUMN IF EXISTS "brochure_sent_at",
      DROP COLUMN IF EXISTS "brochure_send_status",
      DROP COLUMN IF EXISTS "capi_event_name",
      DROP COLUMN IF EXISTS "capi_sent_at",
      DROP COLUMN IF EXISTS "capi_status";
    DROP TYPE IF EXISTS "enum_leads_status";
  `)
}
