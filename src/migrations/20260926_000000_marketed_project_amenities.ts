import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "marketed_projects_amenities" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "marketed_projects"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "marketed_projects_amenities_order_idx"
      ON "marketed_projects_amenities" ("_order");
    CREATE INDEX IF NOT EXISTS "marketed_projects_amenities_parent_id_idx"
      ON "marketed_projects_amenities" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "marketed_projects_amenities";`)
}
