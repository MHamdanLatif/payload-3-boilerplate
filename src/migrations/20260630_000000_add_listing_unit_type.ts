import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Adds the `unit_type` select to property_listings so listings can be filtered
// by exact unit layout (matching FeaturedProjects.unitTypes) on /properties.
// Idempotent: safe on fresh installs and on DBs where dev `push` already created
// the enum/column.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_property_listings_unit_type" AS ENUM(
        '1 Bed Lounge',
        '2 Bed Lounge',
        '2 Bed Drawing',
        '2 Bed DD / 3 Bed Lounge',
        '3 Bed Lounge',
        '3 Bed Drawing',
        '4 Bed Drawing',
        '4+ Rooms'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "property_listings"
      ADD COLUMN IF NOT EXISTS "unit_type" "enum_property_listings_unit_type";
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "property_listings" DROP COLUMN IF EXISTS "unit_type";
    DROP TYPE IF EXISTS "enum_property_listings_unit_type";
  `)
}
