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
      <h1>Projects</h1>
      <p>Advertising money per project. Each project&apos;s money is kept separate, even in a shared bank account.</p>
      <div className="finance-list">
        {projects.map((p) => {
          const pos = byId.get(p.id)
          return (
            <Link key={p.id} className="finance-item" href={`/finance/projects/${p.id}`}>
              <div className="finance-row">
                <h3>{p.title}</h3>
                {pos?.deficitPaisa ? (
                  <Badge tone="alert">Project deficit</Badge>
                ) : pos?.shortfallPaisa ? (
                  <Badge tone="alert">Shortfall</Badge>
                ) : Number(p.funders) ? (
                  <Badge>OK</Badge>
                ) : (
                  <Badge>Set up</Badge>
                )}
              </div>
              <div className="finance-row">
                <span>
                  {Number(p.funders) ? `${p.funders} funder${Number(p.funders) === 1 ? '' : 's'}` : 'No funding split yet'} ·{' '}
                  {p.active_campaigns} active campaign{Number(p.active_campaigns) === 1 ? '' : 's'}
                </span>
                {pos && <span className="finance-amount">{paisaRupees(pos.poolPaisa)} left for ads</span>}
              </div>
              {pos?.deficitPaisa ? <small>Project deficit {paisaRupees(pos.deficitPaisa)}: needs funding</small> : null}
              {pos?.shortfallPaisa ? <small>Top-ups owed: {paisaRupees(pos.shortfallPaisa)}</small> : null}
            </Link>
          )
        })}
      </div>
    </>
  )
}
