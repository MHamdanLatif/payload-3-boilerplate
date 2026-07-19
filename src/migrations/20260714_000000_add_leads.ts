import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Adds the `leads` collection table — a durable backup of every website lead,
// written by /api/leads independent of the Privyr CRM. Idempotent.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "leads" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "phone" varchar NOT NULL,
      "email" varchar,
      "source_kind" varchar,
      "source_name" varchar,
      "source_slug" varchar,
      "placement" varchar,
      "source" varchar,
      "notes" varchar,
      "property_type" varchar,
      "budget" varchar,
      "searched_params" jsonb,
      "privyr_forwarded" boolean DEFAULT false,
      "privyr_status" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "leads" USING btree ("created_at");

    -- Payload's admin document-locking table carries one FK column per
    -- collection; register leads there or the admin panel query fails.
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "leads_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_leads_fk"
        FOREIGN KEY ("leads_id") REFERENCES "leads"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_leads_id_idx"
      ON "payload_locked_documents_rels" USING btree ("leads_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "leads_id";
    DROP TABLE IF EXISTS "leads";
  `)
}
