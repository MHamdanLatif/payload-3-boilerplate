import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_featured_projects_location" ADD VALUE IF NOT EXISTS 'Korangi Creek';
    ALTER TYPE "enum_marketed_projects_location" ADD VALUE IF NOT EXISTS 'Korangi Creek';
    ALTER TYPE "enum_property_listings_location" ADD VALUE IF NOT EXISTS 'Korangi Creek';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve the enum value because saved projects may reference it.
}
