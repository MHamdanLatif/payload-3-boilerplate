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
