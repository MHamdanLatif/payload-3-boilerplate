import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// `isDuplex` — a two-level unit, tracked separately from `unitType`.
//
// Duplex is a LAYOUT; "4 Bed Drawing" is a CONFIGURATION. Adding 'Duplex' as
// another unitType value would have destroyed the bed count on exactly the
// units buyers search for ("4 bed duplex karachi"), and broken the unit-type ->
// room-count mapping the /properties filter relies on. A separate flag keeps
// both facts, and lets one project mix duplex and flat units — which Tulip
// Comfort does (Type A and Type XL are duplexes, Type B is a flat).
//
// Additive with a default, so already-deployed code that never selects these
// columns is unaffected. Idempotent.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "featured_projects_unit_types"
      ADD COLUMN IF NOT EXISTS "is_duplex" boolean DEFAULT false;

    ALTER TABLE "property_listings"
      ADD COLUMN IF NOT EXISTS "is_duplex" boolean DEFAULT false;

    -- Partial indexes: duplex units are a small minority, and every query
    -- against this column filters for true.
    CREATE INDEX IF NOT EXISTS "featured_projects_unit_types_is_duplex_idx"
      ON "featured_projects_unit_types" USING btree ("is_duplex") WHERE "is_duplex";
    CREATE INDEX IF NOT EXISTS "property_listings_is_duplex_idx"
      ON "property_listings" USING btree ("is_duplex") WHERE "is_duplex";
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS "featured_projects_unit_types_is_duplex_idx";
    DROP INDEX IF EXISTS "property_listings_is_duplex_idx";
    ALTER TABLE "featured_projects_unit_types" DROP COLUMN IF EXISTS "is_duplex";
    ALTER TABLE "property_listings" DROP COLUMN IF EXISTS "is_duplex";
  `)
}
