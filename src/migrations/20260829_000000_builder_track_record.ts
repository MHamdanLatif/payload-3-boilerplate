import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// The developer track-record block on project landing pages: an array of the
// builder's earlier projects, plus a relationship to the long-form article.
//
// Written idempotently and applied to production BY HAND before the code
// deploy, because Railway runs no migrations. The table and its first three
// columns already exist in production from that hand-applied pass; the guards
// make this file a no-op there and a full build anywhere else, so a fresh
// environment can be stood up from the repo alone.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS "featured_projects_builder_track_record" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar,
      "location" varchar,
      "detail" varchar,
      "is_current" boolean DEFAULT false
    )
  `)

  // Added after the first pass: the cards carry a photograph of each finished
  // building, a completion year and a status caption.
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "featured_projects_builder_track_record"
      ADD COLUMN IF NOT EXISTS "image_id" integer,
      ADD COLUMN IF NOT EXISTS "completed_year" varchar,
      ADD COLUMN IF NOT EXISTS "status_line" varchar
  `)

  await payload.db.drizzle.execute(sql`
    ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "builder_story_id" integer
  `)

  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "featured_projects_builder_track_record_order_idx"
      ON "featured_projects_builder_track_record" ("_order")
  `)
  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "featured_projects_builder_track_record_parent_id_idx"
      ON "featured_projects_builder_track_record" ("_parent_id")
  `)
  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "featured_projects_builder_track_record_image_idx"
      ON "featured_projects_builder_track_record" ("image_id")
  `)
  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "featured_projects_builder_story_idx"
      ON "featured_projects" ("builder_story_id")
  `)

  // Foreign keys have no IF NOT EXISTS form, so each is guarded by name.
  await payload.db.drizzle.execute(sql`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'featured_projects_builder_track_record_parent_id_fk') THEN
        ALTER TABLE "featured_projects_builder_track_record"
          ADD CONSTRAINT "featured_projects_builder_track_record_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "featured_projects"("id") ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'featured_projects_builder_track_record_image_id_media_id_fk') THEN
        ALTER TABLE "featured_projects_builder_track_record"
          ADD CONSTRAINT "featured_projects_builder_track_record_image_id_media_id_fk"
          FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'featured_projects_builder_story_id_blogs_id_fk') THEN
        ALTER TABLE "featured_projects"
          ADD CONSTRAINT "featured_projects_builder_story_id_blogs_id_fk"
          FOREIGN KEY ("builder_story_id") REFERENCES "blogs"("id") ON DELETE SET NULL;
      END IF;
    END $do$
  `)
}

// Dropping the table would destroy hand-entered editorial content that exists
// nowhere else, so down only removes the join column on featured_projects.
export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "featured_projects" DROP COLUMN IF EXISTS "builder_story_id"
  `)
}
