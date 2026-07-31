import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// "Send File" flow + read receipt:
//   • leads.brochure_opened_at — timestamp of the lead's first brochure open.
//   • crm_settings global — editable WhatsApp message template (no redeploy).
// Idempotent.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "brochure_opened_at" timestamp(3) with time zone;

    CREATE TABLE IF NOT EXISTS "crm_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "whatsapp_message_template" varchar DEFAULT 'Hi {name}, here''s the {project} brochure: {link}',
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "brochure_opened_at";
    DROP TABLE IF EXISTS "crm_settings";
  `)
}
