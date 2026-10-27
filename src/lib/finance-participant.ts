import { sql } from '@payloadcms/db-postgres'
import { dealPosition, projectPosition, type Exec } from './finance-ledger'

/** One participant across projects (funding) and deals (commission). Kept separate. */
export async function participantSummary(exec: Exec, participant: number, asOf?: string) {
  const [[person], projects, splitDeals] = await Promise.all([
    exec(sql`SELECT * FROM finance_participants WHERE id=${participant}`),
    exec(sql`SELECT DISTINCT project_id FROM (
      SELECT project_id FROM finance_funding WHERE participant_id=${participant}
      UNION SELECT project_id FROM finance_ad_charges_shares WHERE participant_id=${participant}
      UNION SELECT r.project_id FROM finance_project_rules_funding f JOIN finance_project_rules r ON r.id=f._parent_id WHERE f.participant_id=${participant}) x`),
    exec(sql`SELECT DISTINCT _parent_id AS deal_id FROM finance_deals_commission_split WHERE participant_id=${participant}
      UNION SELECT deal_id FROM finance_payouts WHERE participant_id=${participant}`),
  ])
  if (!person) return null
  const funding = (
    await Promise.all(
      projects.map(async (p) => {
        const pos = await projectPosition(exec, Number(p.project_id), asOf)
        const me = pos.participants.find((x) => x.key === String(participant))
        return me && { project: Number(p.project_id), title: pos.rules?.title || '', poolPaisa: pos.poolPaisa, ...me }
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => Boolean(x))
  const commission = (
    await Promise.all(
      splitDeals.map(async (d) => {
        const pos = await dealPosition(exec, Number(d.deal_id))
        if (!pos) return null
        const keys = new Set(pos.split.filter((s) => s.participant_id === participant).map((s) => s.key))
        const mine = pos.recipients.filter((r) => keys.has(r.key))
        return {
          deal: Number(d.deal_id),
          client: pos.deal.client_name as string,
          project: pos.deal.project_name as string,
          cancelled: Boolean(pos.deal.cancelled),
          entitlementPaisa: mine.reduce((a, r) => a + r.entitlementPaisa, 0),
          paidPaisa: mine.reduce((a, r) => a + r.paidPaisa, 0),
          unpaidPaisa: mine.reduce((a, r) => a + r.unpaidPaisa, 0),
          overpaidPaisa: mine.reduce((a, r) => a + r.overpaidPaisa, 0),
          recipientKeys: [...keys],
        }
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => Boolean(x))
  return { person, funding, commission }
}
