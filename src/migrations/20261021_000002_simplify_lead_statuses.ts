import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Lead pipeline cut from 14 statuses to 9:
//   New → Contacted → Brochure Not Opened / Engaged → Qualified → Site Visited
//     → Closed Won, plus Not a Fit and Invalid / Junk.
//
// Leads on a removed status are moved to the nearest remaining one first:
//   negotiation, booking-pending → site-visit   (both come after a site visit)
//   unresponsive, nurture        → contacted    (spoken to, still open)
//   lost                         → not-a-fit    (closed without a sale)
// Done in SQL, so no Meta event is sent for the move.
//
// Postgres cannot drop enum values, so the type is rebuilt and the column cast
// across. Kept as one exported string so it can be applied to production by hand.
export const simplifyLeadStatusesSql = `
BEGIN;
UPDATE public.leads SET status = 'site-visit' WHERE status IN ('negotiation', 'booking-pending');
UPDATE public.leads SET status = 'contacted' WHERE status IN ('unresponsive', 'nurture');
UPDATE public.leads SET status = 'not-a-fit' WHERE status = 'lost';
ALTER TYPE public.enum_leads_status RENAME TO enum_leads_status_old;
CREATE TYPE public.enum_leads_status AS ENUM (
  'unqualified', 'contacted', 'details-sent', 'engaged', 'qualified',
  'site-visit', 'closed-won', 'not-a-fit', 'junk'
);
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.leads ALTER COLUMN status TYPE public.enum_leads_status
  USING status::text::public.enum_leads_status;
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'unqualified';
DROP TYPE public.enum_leads_status_old;
COMMIT;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // The migration runner owns the transaction, so drop the explicit one here.
  await db.execute(sql.raw(simplifyLeadStatusesSql.replace(/^(BEGIN|COMMIT);$/gm, '')))
}

// The remap is one-way: which removed status a lead was on is not recorded.
export async function down(_args: MigrateDownArgs): Promise<void> {
  // no-op — see note above
}
