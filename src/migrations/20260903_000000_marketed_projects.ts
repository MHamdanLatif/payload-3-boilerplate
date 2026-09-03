import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import {
  MARKETED_PROJECTS_DDL,
  MARKETED_PROJECTS_ENUM_DDL,
} from './sql/marketedProjects'

// The `marketed-projects` collection — standalone landing pages for paid
// campaigns — plus the two lead columns and two conversion-surface enum values
// that go with it.
//
// Applied to production BY HAND before the code deploy via
// `scripts/sync-marketed-projects-schema.mjs`, because Railway runs no
// migrations. Both read the same statement list, so this file is a faithful
// record of what production received rather than a second, drifting copy.
//
// Every statement is guarded, so this is a no-op against a database that has
// already had the script run against it, and a full build anywhere else.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  for (const statement of MARKETED_PROJECTS_DDL) {
    await payload.db.drizzle.execute(sql.raw(statement))
  }
  // Each ALTER TYPE ... ADD VALUE runs as its own statement on purpose:
  // Postgres will not let a new enum value be referenced in the transaction
  // that adds it.
  for (const statement of MARKETED_PROJECTS_ENUM_DDL) {
    await payload.db.drizzle.execute(sql.raw(statement))
  }
}

// Drops the collection's tables. The lead columns are deliberately left in
// place: `interested_unit_type` and `marketed_project_id` hold real captured
// data that exists nowhere else, and reversing a schema change is not a reason
// to discard it. Enum values cannot be removed by Postgres at all.
export async function down({ payload }: MigrateDownArgs): Promise<void> {
  for (const table of [
    'mp_unit_default_inst',
    'mp_payment_heads',
    'marketed_projects_unit_types',
    'marketed_projects_builder_track_record',
    'marketed_projects_photo_gallery',
    'marketed_projects_elevation_images',
    'marketed_projects',
  ]) {
    await payload.db.drizzle.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`))
  }
}
