import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const value of ['HalfYearly', 'Mixed', 'None']) {
    await db.execute(
      sql.raw(
        `ALTER TYPE "enum_payment_plan_leads_installment_frequency" ADD VALUE IF NOT EXISTS '${value}'`,
      ),
    )
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Additive enum values are retained to preserve recorded lead history.
}
