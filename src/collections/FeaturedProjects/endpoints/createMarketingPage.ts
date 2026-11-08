import type { PayloadHandler } from 'payload'
import { marketingPageCopy } from '@/lib/marketing-page-copy'

export const createMarketingPage: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ error: 'Sign in to create a marketing page.' }, { status: 401 })
  const id = Number(req.routeParams?.id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ error: 'Invalid project.' }, { status: 400 })
  }
  const project = await req.payload.findByID({
    collection: 'featured-projects', id, depth: 0, req, overrideAccess: false,
  })
  // Repeated clicks open the existing copy, preserving campaign edits.
  const existing = await req.payload.find({
    collection: 'marketed-projects', where: { linkedProject: { equals: id } },
    limit: 1, depth: 0, req, overrideAccess: false,
  })
  if (existing.docs[0]) return Response.json({ id: existing.docs[0].id })

  // Campaign suffix avoids application routes; check normalized URL uniqueness.
  const base = (project.slug || `project-${id}`).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 45)
  let slug = `${base}-campaign`
  for (let suffix = 2; ; suffix++) {
    const collision = await req.payload.find({
      collection: 'marketed-projects',
      where: { slugKey: { equals: slug.toLowerCase().replace(/[^a-z0-9]/g, '') } },
      limit: 1, depth: 0, req, overrideAccess: false,
    })
    if (!collision.docs.length) break
    slug = `${base}-campaign-${suffix}`
  }
  const doc = await req.payload.create({
    collection: 'marketed-projects', data: marketingPageCopy(project, slug),
    depth: 0, req, overrideAccess: false,
  })
  return Response.json({ id: doc.id }, { status: 201 })
}
