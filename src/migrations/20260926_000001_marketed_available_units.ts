import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "marketed_projects_available_units" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "marketed_projects"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar,
      "type" varchar NOT NULL,
      "area_sq_ft" numeric
    );
    CREATE INDEX IF NOT EXISTS "marketed_projects_available_units_order_idx"
      ON "marketed_projects_available_units" ("_order");
    CREATE INDEX IF NOT EXISTS "marketed_projects_available_units_parent_id_idx"
      ON "marketed_projects_available_units" ("_parent_id");

    -- Preserve the old hero ordering and duplex labels without carrying pricing
    -- or payment-plan fields into the new CMS list. Legacy tables remain intact.
    INSERT INTO "marketed_projects_available_units" ("_order", "_parent_id", "id", "name", "type", "area_sq_ft")
    SELECT row_number() OVER (PARTITION BY "_parent_id" ORDER BY "rooms", "price", "_order")::integer,
      "_parent_id", "id", "name",
      "type"::text || CASE WHEN "is_duplex" THEN ' (Duplex)' ELSE '' END,
      "area_sq_ft"
    FROM "marketed_projects_unit_types"
    ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "marketed_projects_available_units";`)
}
