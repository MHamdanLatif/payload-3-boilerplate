import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS conversation_notes varchar,
      ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
      ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamptz,
      ADD COLUMN IF NOT EXISTS follow_up_status varchar,
      ADD COLUMN IF NOT EXISTS follow_up_retry_at timestamptz,
      ADD COLUMN IF NOT EXISTS follow_up_claim varchar;
    CREATE INDEX IF NOT EXISTS leads_follow_up_at_idx ON leads (follow_up_at);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS leads_follow_up_at_idx;
    ALTER TABLE leads DROP COLUMN IF EXISTS conversation_notes,
      DROP COLUMN IF EXISTS follow_up_at, DROP COLUMN IF EXISTS follow_up_sent_at,
      DROP COLUMN IF EXISTS follow_up_status, DROP COLUMN IF EXISTS follow_up_retry_at,
      DROP COLUMN IF EXISTS follow_up_claim;
  `)
}
