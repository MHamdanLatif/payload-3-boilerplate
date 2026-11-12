import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function crmSession(path = '/leads-dashboard') {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect(`/leads-dashboard/login?next=${encodeURIComponent(path)}`)
  return { payload, user }
}

export async function crmProjects() {
  const { payload, user } = await crmSession()
  const result = await payload.find({
    collection: 'featured-projects',
    depth: 0,
    pagination: false,
    limit: 1000,
    sort: 'title',
    overrideAccess: false,
    user,
    select: { title: true, slug: true },
  })
  return result.docs.map(({ id, title }) => ({ id, title }))
}

export async function crmManualProjects() {
  const { payload, user } = await crmSession()
  const [featured, marketed] = await Promise.all([
    crmProjects(),
    payload.find({
      collection: 'marketed-projects',
      depth: 0,
      pagination: false,
      sort: 'title',
      overrideAccess: false,
      user,
      select: { title: true },
    }),
  ])
  // Collection-qualified values prevent collisions between the two ID spaces.
  return [
    ...featured.map(({ id, title }) => ({ id: String(id), title })),
    ...marketed.docs.map(({ id, title }) => ({ id: `marketed:${id}`, title })),
  ].sort((a, b) => a.title.localeCompare(b.title))
}
