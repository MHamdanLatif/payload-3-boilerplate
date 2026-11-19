import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "enum_leads_status" ADD VALUE IF NOT EXISTS 'site-visit-pending' BEFORE 'site-visit'`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep this value so rollback does not discard leads' saved status.
}
