import { expect, type Page } from '@playwright/test'

/**
 * A pack link sent before the project's video or map changed must show the
 * project's current assets, not the ones copied onto the lead at creation.
 */
export async function verifyPackAssetsLive(admin: Page, visitor: Page) {
  const media = await (await admin.request.get('/api/media?limit=1')).json()
  const projectRes = await admin.request.post('/api/featured-projects', {
    data: {
      title: 'Pack Live Assets Test',
      slug: 'pack-live-assets-test',
      builderName: 'Test Builder',
      propertyType: 'Flat',
      location: 'Scheme 33',
      status: 'Pre-launch',
      elevationImages: [{ image: media.docs[0].id }],
      walkthroughVideoUrl: 'https://www.youtube.com/watch?v=oldvideo01',
      googleMapsEmbedUrl: 'https://www.google.com/maps/embed?pb=old-map',
    },
  })
  expect(projectRes.ok(), await projectRes.text()).toBeTruthy()
  const project = (await projectRes.json()).doc

  const leadRes = await admin.request.post('/api/leads', {
    data: {
      name: 'Pack Live Buyer',
      phone: '03001234567',
      sourceKind: 'project',
      sourceSlug: 'pack-live-assets-test',
    },
  })
  expect(leadRes.ok(), await leadRes.text()).toBeTruthy()
  const lead = (await leadRes.json()).doc
  expect(lead.brochureVideoUrl).toBe('https://www.youtube.com/watch?v=oldvideo01')

  const video = visitor.getByTitle('Walkthrough video')
  const map = visitor.getByTitle('Location map')
  await visitor.goto(`/brochure/${lead.brochureId}`)
  await expect(video).toHaveAttribute('src', /oldvideo01/)
  await expect(map).toHaveAttribute('src', /old-map/)

  const patched = await admin.request.patch(`/api/featured-projects/${project.id}`, {
    data: {
      walkthroughVideoUrl: 'https://www.youtube.com/watch?v=newvideo02',
      googleMapsEmbedUrl: 'https://www.google.com/maps/embed?pb=new-map',
    },
  })
  expect(patched.ok(), await patched.text()).toBeTruthy()

  await visitor.goto(`/brochure/${lead.brochureId}`)
  await expect(video).toHaveAttribute('src', /newvideo02/)
  await expect(map).toHaveAttribute('src', /new-map/)

  expect((await admin.request.delete(`/api/leads/${lead.id}`)).ok()).toBeTruthy()
  expect((await admin.request.delete(`/api/featured-projects/${project.id}`)).ok()).toBeTruthy()
}
