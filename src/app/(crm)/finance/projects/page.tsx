import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeExec } from '@/lib/finance-server'
import { allProjectPositions } from '@/lib/finance-ledger'
import { paisaRupees } from '@/lib/finance-query'
import { Badge } from '@/components/finance/FinanceUI'

export default async function Projects() {
  const exec = await financeExec()
  // Every CMS project appears here automatically: Finance uses the same project record.
  const [projects, positions] = await Promise.all([
    exec(sql`SELECT p.id, p.title, r.id AS rules_id,
      (SELECT COUNT(*) FROM finance_project_rules_funding f WHERE f._parent_id=r.id) AS funders,
      (SELECT COUNT(*) FROM finance_campaigns c WHERE c.project_id=p.id AND c.status='active') AS active_campaigns
      FROM featured_projects p LEFT JOIN finance_project_rules r ON r.project_id=p.id ORDER BY p.title`),
    allProjectPositions(exec),
  ])
  const byId = new Map(positions.map((x) => [x.project, x]))
  return (
    <>
      <h2>Projects</h2>
      <p>
        Each project&apos;s advertising money is kept separate, even when projects share one bank account. Remaining cash is
        what the project&apos;s own funding still has; participant balances can be higher than the cash backing them.
      </p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Project', 'Funding split', 'Active campaigns', 'Advertising cash remaining', 'Participant shortfalls', 'Unbacked entitlements', 'Status'].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const pos = byId.get(p.id)
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/finance/projects/${p.id}`}>{p.title}</Link>
                  </td>
                  <td>{Number(p.funders) ? `${p.funders} participant${Number(p.funders) === 1 ? '' : 's'}` : 'Not set'}</td>
                  <td>{p.active_campaigns}</td>
                  <td>{pos ? paisaRupees(pos.poolPaisa) : '—'}</td>
                  <td>{pos?.shortfallPaisa ? paisaRupees(pos.shortfallPaisa) : '—'}</td>
                  <td>{pos?.unbackedPaisa ? paisaRupees(pos.unbackedPaisa) : '—'}</td>
                  <td>
                    {pos?.deficitPaisa ? (
                      <Badge tone="alert">Project deficit</Badge>
                    ) : pos?.shortfallPaisa ? (
                      <Badge tone="alert">Shortfall</Badge>
                    ) : Number(p.funders) ? (
                      <Badge>OK</Badge>
                    ) : (
                      <Badge>Set up</Badge>
                    )}
                    {pos?.deficitPaisa ? <small> Project deficit {paisaRupees(pos.deficitPaisa)}: needs funding</small> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
