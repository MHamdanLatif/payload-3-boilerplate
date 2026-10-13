import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lead_schedules (
      id serial PRIMARY KEY, lead_id integer NOT NULL REFERENCES leads(id) ON DELETE SET NULL,
      title varchar NOT NULL, entry_key varchar NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS lead_schedules_lead_idx ON lead_schedules(lead_id);
    CREATE UNIQUE INDEX IF NOT EXISTS lead_schedules_entry_key_idx ON lead_schedules(entry_key);
    CREATE INDEX IF NOT EXISTS lead_schedules_updated_at_idx ON lead_schedules(updated_at);
    CREATE INDEX IF NOT EXISTS lead_schedules_created_at_idx ON lead_schedules(created_at);
    CREATE TABLE IF NOT EXISTS schedule_revisions (
      id serial PRIMARY KEY, schedule_id integer NOT NULL REFERENCES lead_schedules(id) ON DELETE SET NULL,
      revision numeric NOT NULL, revision_key varchar NOT NULL, settings jsonb NOT NULL,
      buyer_name varchar NOT NULL, buyer_phone varchar NOT NULL, note varchar,
      created_by_id integer NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS schedule_revisions_schedule_idx ON schedule_revisions(schedule_id);
    CREATE UNIQUE INDEX IF NOT EXISTS schedule_revisions_revision_key_idx ON schedule_revisions(revision_key);
    CREATE INDEX IF NOT EXISTS schedule_revisions_created_by_idx ON schedule_revisions(created_by_id);
    CREATE INDEX IF NOT EXISTS schedule_revisions_updated_at_idx ON schedule_revisions(updated_at);
    CREATE INDEX IF NOT EXISTS schedule_revisions_created_at_idx ON schedule_revisions(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS lead_schedules_id integer REFERENCES lead_schedules(id) ON DELETE CASCADE;
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS schedule_revisions_id integer REFERENCES schedule_revisions(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_lead_schedules_id_idx ON payload_locked_documents_rels(lead_schedules_id);
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_schedule_revisions_id_idx ON payload_locked_documents_rels(schedule_revisions_id);
  `)
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Saved client schedules are preserved. Restore a reviewed backup to roll back.')
}
