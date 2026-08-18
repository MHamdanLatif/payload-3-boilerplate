import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Two new lead statuses: "Site Visit" and "Closed Won".
//
// Positioned with AFTER so the enum's sort order reads as the sales funnel —
// unqualified, contacted, qualified, site-visit, closed-won, junk — which is
// what any ORDER BY status will follow. Junk stays last: it is terminal, not a
// funnel stage.
//
// Each ALTER TYPE ... ADD VALUE runs as its OWN statement on purpose. Postgres
// will not let a new enum value be referenced in the same transaction that adds
// it, so these must not be batched with anything that uses them.
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(
    sql`ALTER TYPE "enum_leads_status" ADD VALUE IF NOT EXISTS 'site-visit' AFTER 'qualified'`,
  )
  await payload.db.drizzle.execute(
    sql`ALTER TYPE "enum_leads_status" ADD VALUE IF NOT EXISTS 'closed-won' AFTER 'site-visit'`,
  )
}

// Postgres cannot drop a value from an enum. Reversing means recreating the
// type and rewriting the column, which would fail while any row still uses the
// values — so this is deliberately a no-op rather than a destructive rebuild.
export async function down(_args: MigrateDownArgs): Promise<void> {
  // no-op — see note above
}
