import type { Payload } from 'payload'

// Repeat enquiries are found by normalised phone only (see phone-key.ts), never by name.
// Nothing here merges, deletes or re-sends anything: it only finds and links records.

type Auth = { payload: Payload; user: Parameters<Payload['find']>[0]['user'] }

export async function leadsWithPhoneKey({ payload, user }: Auth, key: string | null | undefined, exclude?: number) {
  if (!key) return []
  const res = await payload.find({
    collection: 'leads',
    where: { and: [{ phoneKey: { equals: key } }, ...(exclude ? [{ id: { not_equals: exclude } }] : [])] },
    depth: 1,
    limit: 50,
    sort: '-createdAt',
    overrideAccess: false,
    user,
    select: { name: true, phone: true, status: true, createdAt: true, currentInterestedProject: true, sourceName: true },
  })
  return res.docs.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    createdAt: d.createdAt,
    project:
      (typeof d.currentInterestedProject === 'object' ? d.currentInterestedProject?.title : null) || d.sourceName || null,
  }))
}

/** How many leads share each phone key, for the badges on a page of leads. */
export async function phoneKeyCounts({ payload, user }: Auth, keys: (string | null | undefined)[]) {
  const wanted = [...new Set(keys.filter((k): k is string => Boolean(k)))]
  const counts = new Map<string, number>()
  if (!wanted.length) return counts
  const res = await payload.find({
    collection: 'leads',
    where: { phoneKey: { in: wanted } },
    depth: 0,
    limit: 5000,
    pagination: false,
    overrideAccess: false,
    user,
    select: { phoneKey: true },
  })
  for (const d of res.docs) if (d.phoneKey) counts.set(d.phoneKey, (counts.get(d.phoneKey) || 0) + 1)
  return counts
}
