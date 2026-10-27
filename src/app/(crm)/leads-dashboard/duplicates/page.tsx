import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { crmSession } from '@/lib/crm-server'
import { statusLabel } from '@/lib/lead-status'
import { leadSourceLabel } from '@/lib/lead-labels'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Repeat enquiries', robots: { index: false, follow: false } }

// Review of leads that share a phone number. Matching is by normalised phone only; names
// are ignored. Nothing is merged or deleted here, and no conversion event is sent.
export default async function Duplicates() {
  const { payload, user } = await crmSession('/leads-dashboard/duplicates')
  const groups = (
    await payload.db.drizzle.execute(sql`SELECT phone_key, COUNT(*)::int AS n, MAX(created_at) AS latest
      FROM leads WHERE phone_key IS NOT NULL GROUP BY phone_key HAVING COUNT(*) > 1 ORDER BY latest DESC LIMIT 100`)
  ).rows as { phone_key: string; n: number }[]
  const [{ unrecognised }] = (
    await payload.db.drizzle.execute(sql`SELECT COUNT(*)::int AS unrecognised FROM leads WHERE phone_key IS NULL`)
  ).rows as { unrecognised: number }[]
  const leads = groups.length
    ? (
        await payload.find({
          collection: 'leads',
          where: { phoneKey: { in: groups.map((g) => g.phone_key) } },
          depth: 1,
          limit: 1000,
          pagination: false,
          sort: '-createdAt',
          overrideAccess: false,
          user,
          select: {
            name: true,
            phone: true,
            phoneKey: true,
            status: true,
            sourceName: true,
            source: true,
            acquisitionSource: true,
            conversionSurface: true,
            sourceKind: true,
            metaAdName: true,
            currentInterestedProject: true,
            createdAt: true,
          },
        })
      ).docs
    : []
  return (
    <main className="crm-wrap">
      <Link href="/leads-dashboard" className="crm-muted">
        Back to leads
      </Link>
      <p className="crm-eyebrow mt-7">Same phone number, more than one record</p>
      <h1 className="crm-title">Repeat enquiries</h1>
      <p className="crm-muted mt-2 mb-6">
        Matched by phone number only (03…, 92… and +92… count as the same number). Names are never used. Each record keeps its own
        project, source, notes, schedules and finance deal; nothing is merged automatically.
        {unrecognised > 0 && ` ${unrecognised} lead(s) have a number that could not be recognised and are never matched.`}
      </p>
      {groups.map((g) => (
        <section key={g.phone_key} className="crm-panel mb-4">
          <h2 className="font-semibold">
            {g.phone_key} · {g.n} records
          </h2>
          <ul className="mt-2 text-sm">
            {leads
              .filter((l) => l.phoneKey === g.phone_key)
              .map((l) => (
                <li key={l.id} className="mt-1">
                  <Link className="underline" href={'/leads-dashboard/' + l.id}>
                    {l.name}
                  </Link>{' '}
                  · {(typeof l.currentInterestedProject === 'object' && l.currentInterestedProject?.title) || l.sourceName || 'No project'} ·{' '}
                  {leadSourceLabel(l)} · {statusLabel(l.status)} ·{' '}
                  {new Date(l.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' })}
                </li>
              ))}
          </ul>
        </section>
      ))}
      {!groups.length && (
        <div className="crm-panel crm-empty">
          <p className="crm-muted">No repeated phone numbers.</p>
        </div>
      )}
    </main>
  )
}
