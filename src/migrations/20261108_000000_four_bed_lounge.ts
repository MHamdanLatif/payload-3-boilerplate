import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_featured_projects_unit_types_type" ADD VALUE IF NOT EXISTS '4 Bed Lounge / 3 Bed Drawing';
    ALTER TYPE "enum_property_listings_unit_type" ADD VALUE IF NOT EXISTS '4 Bed Lounge / 3 Bed Drawing';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot remove an enum value without recreating the type and
  // potentially destroying saved unit configurations. Preserve existing data.
}
