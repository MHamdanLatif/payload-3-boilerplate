import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE crm_settings ADD COLUMN IF NOT EXISTS automatic_uncontacted_reminders boolean DEFAULT true;
    ALTER TABLE crm_settings ADD COLUMN IF NOT EXISTS notification_start_at timestamp(3) with time zone;
    INSERT INTO crm_settings (id, automatic_uncontacted_reminders, notification_start_at)
      SELECT 1, true, NOW() WHERE NOT EXISTS (SELECT 1 FROM crm_settings)
      ON CONFLICT (id) DO NOTHING;
    UPDATE crm_settings SET notification_start_at = NOW() WHERE notification_start_at IS NULL;
    CREATE TABLE IF NOT EXISTS lead_notifications (
      id serial PRIMARY KEY NOT NULL,
      event_key varchar NOT NULL,
      lead_id integer,
      kind varchar NOT NULL,
      due_at timestamp(3) with time zone NOT NULL,
      expires_at timestamp(3) with time zone NOT NULL,
      retry_at timestamp(3) with time zone,
      claim varchar,
      finished_at timestamp(3) with time zone,
      attempts numeric DEFAULT 0,
      receipts jsonb DEFAULT '[]'::jsonb,
      delivery_status varchar,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE lead_notifications ADD CONSTRAINT lead_notifications_lead_id_leads_id_fk
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE UNIQUE INDEX IF NOT EXISTS lead_notifications_event_key_idx ON lead_notifications(event_key);
    CREATE INDEX IF NOT EXISTS lead_notifications_lead_idx ON lead_notifications(lead_id);
    CREATE INDEX IF NOT EXISTS lead_notifications_due_at_idx ON lead_notifications(due_at);
    CREATE INDEX IF NOT EXISTS lead_notifications_updated_at_idx ON lead_notifications(updated_at);
    CREATE INDEX IF NOT EXISTS lead_notifications_created_at_idx ON lead_notifications(created_at);
    CREATE INDEX IF NOT EXISTS lead_notifications_pending_idx ON lead_notifications(retry_at, due_at) WHERE finished_at IS NULL;
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS lead_notifications_id integer;
    DO $$ BEGIN
      ALTER TABLE payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_lead_notifications_fk
        FOREIGN KEY (lead_notifications_id) REFERENCES lead_notifications(id) ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_lead_notifications_id_idx
      ON payload_locked_documents_rels(lead_notifications_id);
  `)
}
export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS lead_notifications_id;
    DROP TABLE IF EXISTS lead_notifications;
    ALTER TABLE crm_settings DROP COLUMN IF EXISTS automatic_uncontacted_reminders;
    ALTER TABLE crm_settings DROP COLUMN IF EXISTS notification_start_at;
  `)
}
