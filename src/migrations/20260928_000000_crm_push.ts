import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "crm_push_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "public_key" varchar NOT NULL,
      "private_key" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
    CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" serial PRIMARY KEY NOT NULL,
      "endpoint_hash" varchar NOT NULL,
      "endpoint" varchar NOT NULL,
      "p256dh" varchar NOT NULL,
      "auth" varchar NOT NULL,
      "owner_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_owner_id_users_id_fk"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_hash_idx" ON "push_subscriptions" ("endpoint_hash");
    CREATE INDEX IF NOT EXISTS "push_subscriptions_owner_idx" ON "push_subscriptions" ("owner_id");
    CREATE INDEX IF NOT EXISTS "push_subscriptions_updated_at_idx" ON "push_subscriptions" ("updated_at");
    CREATE INDEX IF NOT EXISTS "push_subscriptions_created_at_idx" ON "push_subscriptions" ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "push_subscriptions_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk"
        FOREIGN KEY ("push_subscriptions_id") REFERENCES "push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_push_subscriptions_id_idx"
      ON "payload_locked_documents_rels" ("push_subscriptions_id");
  `)
}
export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "push_subscriptions_id";
    DROP TABLE IF EXISTS "push_subscriptions";
    DROP TABLE IF EXISTS "crm_push_settings";
  `)
}
