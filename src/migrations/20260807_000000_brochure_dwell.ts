import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Time-on-page tracking for brochure links.
//   visit_id — per-render id written with the page-open row; the client's dwell
//              beacon echoes it so the update lands on that exact open.
//   dwell_ms — foreground milliseconds the lead spent on the page.
// Idempotent.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "link_opens" ADD COLUMN IF NOT EXISTS "visit_id" varchar;
    ALTER TABLE "link_opens" ADD COLUMN IF NOT EXISTS "dwell_ms" numeric;

    CREATE INDEX IF NOT EXISTS "link_opens_visit_id_idx"
      ON "link_opens" USING btree ("visit_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS "link_opens_visit_id_idx";
    ALTER TABLE "link_opens" DROP COLUMN IF EXISTS "visit_id";
    ALTER TABLE "link_opens" DROP COLUMN IF EXISTS "dwell_ms";
  `)
}
