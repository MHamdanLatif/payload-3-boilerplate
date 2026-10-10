import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_featured_projects_status" ADD VALUE IF NOT EXISTS 'Ready to Move';
    ALTER TYPE "enum_marketed_projects_status" ADD VALUE IF NOT EXISTS 'Ready to Move';
    DO $$ BEGIN
      CREATE TYPE "enum_featured_projects_sales_availability" AS ENUM ('available', 'sold-out', 'withdrawn');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "enum_marketed_projects_sales_availability" AS ENUM ('available', 'sold-out', 'withdrawn');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "sales_availability" "enum_featured_projects_sales_availability" DEFAULT 'available';
    ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "builder_marketing_notes" varchar;
    ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "possession_information" varchar;
    ALTER TABLE "featured_projects" ADD COLUMN IF NOT EXISTS "ready_payment_plan_confirmed" boolean DEFAULT false;
    ALTER TABLE "marketed_projects" ADD COLUMN IF NOT EXISTS "sales_availability" "enum_marketed_projects_sales_availability" DEFAULT 'available';
    ALTER TABLE "marketed_projects" ADD COLUMN IF NOT EXISTS "builder_marketing_notes" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Retain added enum values and historical data; reverting the application does
  // not require destructive drops or rewriting ready-project statuses.
  await db.execute(sql`SELECT 1`)
}
