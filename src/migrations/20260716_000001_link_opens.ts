import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// `link-opens`: one row per brochure engagement event (page open / asset view).
// Also wires the collection into `payload_locked_documents_rels` so the admin
// document-locking join doesn't 500. Idempotent.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_link_opens_asset" AS ENUM('page','pdf1','pdf2','map','video');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "link_opens" (
      "id" serial PRIMARY KEY NOT NULL,
      "lead_id" integer,
      "brochure_id" varchar,
      "asset" "enum_link_opens_asset" DEFAULT 'page',
      "ip" varchar,
      "user_agent" varchar,
      "referrer" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "link_opens" ADD CONSTRAINT "link_opens_lead_id_leads_id_fk"
        FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "link_opens_lead_idx" ON "link_opens" USING btree ("lead_id");
    CREATE INDEX IF NOT EXISTS "link_opens_brochure_id_idx" ON "link_opens" USING btree ("brochure_id");
    CREATE INDEX IF NOT EXISTS "link_opens_updated_at_idx" ON "link_opens" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "link_opens_created_at_idx" ON "link_opens" USING btree ("created_at");

    -- admin document-locking join column (or the admin panel 500s)
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "link_opens_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_link_opens_fk"
        FOREIGN KEY ("link_opens_id") REFERENCES "link_opens"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_link_opens_id_idx"
      ON "payload_locked_documents_rels" USING btree ("link_opens_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "link_opens_id";
    DROP TABLE IF EXISTS "link_opens";
    DROP TYPE IF EXISTS "enum_link_opens_asset";
  `)
}
