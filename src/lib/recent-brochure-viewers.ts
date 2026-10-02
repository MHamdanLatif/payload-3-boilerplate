import type { Payload, Where } from 'payload'
import type { User } from '@/payload-types'

export async function recentBrochureViewers(payload: Payload, user: User, now = new Date()) {
  const opens = await payload.find({
    collection: 'link-opens',
    overrideAccess: false,
    user,
    depth: 0,
    pagination: false,
    sort: '-createdAt',
    where: {
      and: [
        { asset: { equals: 'page' } },
        {
          createdAt: { greater_than_equal: new Date(now.getTime() - 7 * 86400_000).toISOString() },
        },
        { createdAt: { less_than_equal: now.toISOString() } },
      ],
    },
    select: { lead: true, brochureId: true, createdAt: true, dwellMs: true },
  })
  if (!opens.docs.length) return []
  const leadIds = [
    ...new Set(opens.docs.flatMap((o) => (typeof o.lead === 'number' ? [o.lead] : []))),
  ]
  const brochureIds = [...new Set(opens.docs.flatMap((o) => (o.brochureId ? [o.brochureId] : [])))]
  const or: Where[] = []
  if (leadIds.length) or.push({ id: { in: leadIds } })
  if (brochureIds.length) or.push({ brochureId: { in: brochureIds } })
  if (!or.length) return []
  const leads = await payload.find({
    collection: 'leads',
    overrideAccess: false,
    user,
    depth: 0,
    pagination: false,
    where: { or },
    select: { name: true, phone: true, brochureId: true, sourceName: true, brochureHeadline: true },
  })
  const byId = new Map(leads.docs.map((lead) => [lead.id, lead]))
  const byBrochure = new Map(
    leads.docs.filter((lead) => lead.brochureId).map((lead) => [lead.brochureId, lead]),
  )
  const viewers = new Map<
    number,
    {
      lead: (typeof leads.docs)[number]
      visits: typeof opens.docs
      totalMs: number
      captured: number
    }
  >()
  for (const open of opens.docs) {
    // Older events may have no relationship; their personal link still identifies the lead.
    const lead =
      (typeof open.lead === 'number' ? byId.get(open.lead) : undefined) ??
      (open.brochureId ? byBrochure.get(open.brochureId) : undefined)
    if (!lead) continue
    let viewer = viewers.get(lead.id)
    if (!viewer) {
      viewer = { lead, visits: [], totalMs: 0, captured: 0 }
      viewers.set(lead.id, viewer)
    }
    viewer.visits.push(open)
    if (open.dwellMs && open.dwellMs > 0) {
      viewer.totalMs += open.dwellMs
      viewer.captured++
    }
  }
  return [...viewers.values()]
}
