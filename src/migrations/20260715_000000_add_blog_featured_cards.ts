import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Adds the Blogs `featuredCards` array (manual project/listing cards shown at
// the end of a post). Mirrors the blogs_seo_internal_links array table.
// Idempotent.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_blogs_featured_cards_card_type" AS ENUM('project','listing');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "blogs_featured_cards" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "card_type" "enum_blogs_featured_cards_card_type" DEFAULT 'project' NOT NULL,
      "target_project_id" integer,
      "target_listing_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "blogs_featured_cards" ADD CONSTRAINT "blogs_featured_cards_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "blogs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "blogs_featured_cards" ADD CONSTRAINT "blogs_featured_cards_target_project_id_featured_projects_id"
        FOREIGN KEY ("target_project_id") REFERENCES "featured_projects"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "blogs_featured_cards" ADD CONSTRAINT "blogs_featured_cards_target_listing_id_property_listings_id"
        FOREIGN KEY ("target_listing_id") REFERENCES "property_listings"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "blogs_featured_cards_order_idx" ON "blogs_featured_cards" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "blogs_featured_cards_parent_id_idx" ON "blogs_featured_cards" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "blogs_featured_cards_target_project_idx" ON "blogs_featured_cards" USING btree ("target_project_id");
    CREATE INDEX IF NOT EXISTS "blogs_featured_cards_target_listing_idx" ON "blogs_featured_cards" USING btree ("target_listing_id");
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "blogs_featured_cards";
    DROP TYPE IF EXISTS "enum_blogs_featured_cards_card_type";
  `)
}
