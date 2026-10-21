import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Follow-ups stay until marked contacted (one repeat reminder), per-device push
// retry caps, and phone/tablet sessions for the two-device sign-in limit.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "follow_up_repeat_sent_at" timestamp(3) with time zone;
    ALTER TABLE "lead_notifications" ADD COLUMN IF NOT EXISTS "device_attempts" jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "session_id" varchar;
    CREATE INDEX IF NOT EXISTS "push_subscriptions_session_id_idx" ON "push_subscriptions" ("session_id");
    CREATE TABLE IF NOT EXISTS "crm_devices" (
      "id" serial PRIMARY KEY NOT NULL,
      "session_id" varchar NOT NULL,
      "owner_id" integer,
      "description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "crm_devices" ADD CONSTRAINT "crm_devices_owner_id_users_id_fk"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE UNIQUE INDEX IF NOT EXISTS "crm_devices_session_id_idx" ON "crm_devices" ("session_id");
    CREATE INDEX IF NOT EXISTS "crm_devices_owner_idx" ON "crm_devices" ("owner_id");
    CREATE INDEX IF NOT EXISTS "crm_devices_updated_at_idx" ON "crm_devices" ("updated_at");
    CREATE INDEX IF NOT EXISTS "crm_devices_created_at_idx" ON "crm_devices" ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "crm_devices_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_crm_devices_fk"
        FOREIGN KEY ("crm_devices_id") REFERENCES "crm_devices"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_crm_devices_id_idx"
      ON "payload_locked_documents_rels" ("crm_devices_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "crm_devices_id";
    DROP TABLE IF EXISTS "crm_devices";
    DROP INDEX IF EXISTS "push_subscriptions_session_id_idx";
    ALTER TABLE "push_subscriptions" DROP COLUMN IF EXISTS "session_id";
    ALTER TABLE "lead_notifications" DROP COLUMN IF EXISTS "device_attempts";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "follow_up_repeat_sent_at";
  `)
}
