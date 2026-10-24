import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Per-unit "Sold out" flag on organic projects. Additive with a default, so the
// currently deployed build keeps working before the new code ships.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "featured_projects_unit_types"
      ADD COLUMN IF NOT EXISTS "sold_out" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "featured_projects_unit_types" DROP COLUMN IF EXISTS "sold_out";
  `)
}
