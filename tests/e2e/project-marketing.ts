import { expect, type Page, type TestInfo } from '@playwright/test'

export async function verifyProjectMarketing(admin: Page, visitor: Page, info: TestInfo) {
  const media = await (await admin.request.get('/api/media?limit=1')).json()
  const create = async (collection: string, data: Record<string, unknown>) => {
    const response = await admin.request.post(`/api/${collection}`, { data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).doc
  }
  const common = {
    builderName: 'E2E Builder',
    propertyType: 'Flat',
    location: 'Scheme 33',
    elevationImages: [{ image: media.docs[0].id }],
    unitTypes: [{ type: '3 Bed Lounge', rooms: 3, price: 12000000 }],
    startingPrice: 12000000,
    builderMarketingNotes: 'PRIVATE CONTRACT DETAILS',
  }
  const ready = await create('featured-projects', {
    ...common,
    title: 'Ready Builder E2E',
    slug: 'ready-builder-e2e',
    status: 'Ready to Move',
    possessionInformation: 'Builder handover after final settlement.',
    paymentPlan: { enabled: false },
  })
  const withdrawn = await create('featured-projects', {
    ...common,
    title: 'Withdrawn Builder E2E',
    slug: 'withdrawn-builder-e2e',
    status: 'Under Construction',
    salesAvailability: 'withdrawn',
  })
  const listing = await create('property-listings', {
    title: 'Private Resale E2E',
    slug: 'private-resale-e2e',
    propertyType: 'Flat',
    location: 'Scheme 33',
    price: 9000000,
    status: 'Resale',
    mainImage: media.docs[0].id,
  })
  const ad = await create('marketed-projects', {
    title: 'Ready Campaign E2E',
    slug: 'ReadyCampaignE2E',
    builderName: 'E2E Builder',
    location: 'Scheme 33',
    status: 'Ready to Move',
    elevationImages: [{ image: media.docs[0].id }],
    active: true,
  })
  try {
    await visitor.goto('/properties?status=Ready')
    await expect(visitor.getByRole('heading', { name: ready.title })).toBeVisible()
    await expect(visitor.getByText(listing.title)).toHaveCount(0)
    await expect(visitor.getByText(withdrawn.title)).toHaveCount(0)
    await visitor.goto('/properties?status=Ready&budget=under-15m')
    await expect(visitor.getByRole('heading', { name: ready.title })).toBeVisible()
    await visitor.goto('/properties?status=Ready&budget=15m-25m')
    await expect(visitor.getByRole('heading', { name: ready.title })).toHaveCount(0)
    await expect(visitor.getByRole('link', { name: 'Clear all filters' })).toBeVisible()
    await visitor.goto('/properties?location=Scheme+33&unitType=3+Bed+Lounge')
    await expect(visitor.getByRole('heading', { name: ready.title })).toBeVisible()
    expect((await visitor.request.get(`/listings/${listing.slug}`)).status()).toBe(404)
    // Only the owner's known retired URLs redirect; unrelated listing URLs stay 404.
    for (const path of [
      '/blog/an-opportunity-4-bed-flat-in-gulshan-e-iqbal',
      '/blog/an-opportunity-4-bed-flat-in-gulshan-e-iqbal-',
      '/listings/4-bed-flat-in-saim-residency-gulshan-e-iqbal-13-d2-urgent-sale',
      '/listings/4-bed-flat-in-saim-residency-gulshan-e-iqbal-13-d2--urgent-sale',
      '/listings/4-bed-duplex-apartment-in-lateef-duplex-luxuria-scheme-33',
      '/featured/lateef-duplex-luxuria',
      '/listings/3-bed-drawing-lounge-flat-in-rim-jhim-villas-scheme-33-roof-terrace',
      '/listings/3-bed-drawing-lounge-flat-in-rim-jhim-villas-scheme-33--roof-terrace',
    ]) {
      const response = await visitor.request.get(path, { maxRedirects: 0 })
      expect(response.status()).toBe(308)
      expect(new URL(response.headers().location, visitor.url()).pathname).toBe('/properties')
    }

    expect((await visitor.request.get(`/projects/${withdrawn.slug}`)).status()).toBe(404)
    expect(
      (await visitor.request.get(`/api/property-listings/${listing.id}`)).status(),
    ).toBeGreaterThanOrEqual(400)
    const publicProject = await (
      await visitor.request.get(`/api/featured-projects/${ready.id}`)
    ).json()
    expect(publicProject.builderMarketingNotes).toBeUndefined()
    expect(
      (await visitor.request.get(`/api/featured-projects/${withdrawn.id}`)).status(),
    ).toBeGreaterThanOrEqual(400)
    await visitor.goto(`/projects/${ready.slug}`)
    await expect(visitor.getByText('Builder handover after final settlement.')).toBeVisible()
    await expect(visitor.locator('#payment-plan')).toHaveCount(0)
    expect(await visitor.locator('body').textContent()).not.toContain('PRIVATE CONTRACT DETAILS')
    await visitor.goto(`/${ad.slug}`)
    await expect(visitor.getByRole('heading', { name: ad.title, exact: true })).toBeVisible()
    expect(
      (
        await admin.request.patch(`/api/marketed-projects/${ad.id}`, {
          data: { salesAvailability: 'sold-out' },
        })
      ).ok(),
    ).toBeTruthy()
    expect(
      (await visitor.request.get(`/api/marketed-projects/${ad.id}`)).status(),
    ).toBeGreaterThanOrEqual(400)
    const sitemap = await (await visitor.request.get('/sitemap.xml')).text()
    expect(sitemap).toContain(`/projects/${ready.slug}`)
    expect(sitemap).not.toContain('/listings/')
    expect(sitemap).not.toContain(withdrawn.slug)
    await visitor.goto('/')
    await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(
      'Explore Property Projects in Karachi',
    )
    await expect(visitor.locator('a[href^="/listings/"]')).toHaveCount(0)
    await expect(visitor.locator('#developers')).toHaveCount(0)
    const form = visitor.locator('#contact form')
    await form.getByLabel('Full Name', { exact: true }).fill('Buyer Optional E2E')
    await form.getByLabel('WhatsApp Number', { exact: true }).fill('03001234567')
    // No optional values are necessary to reach the existing CRM.
    await form.getByRole('button', { name: 'Discuss My Options' }).click()
    await expect(visitor.getByText('Your enquiry has been received.')).toBeVisible()
    const optionalLeads = await (
      await admin.request.get('/api/leads?where[name][equals]=Buyer%20Optional%20E2E')
    ).json()
    expect(optionalLeads.docs).toHaveLength(1)
    expect(optionalLeads.docs[0].source).toBe('home:consultation')
    await admin.request.delete(`/api/leads/${optionalLeads.docs[0].id}`)
    await visitor.getByRole('button', { name: 'Send another enquiry' }).click()
    await form.getByLabel('Full Name', { exact: true }).fill('Buyer Project E2E')
    await form.getByLabel('WhatsApp Number', { exact: true }).fill('03001234567')
    await form.getByLabel('Project of Interest (optional)').selectOption(String(ready.id))
    await form.getByRole('button', { name: 'Discuss My Options' }).click()
    await expect(visitor.getByText('Your enquiry has been received.')).toBeVisible()
    const leads = await (
      await admin.request.get('/api/leads?where[name][equals]=Buyer%20Project%20E2E&depth=0')
    ).json()
    const lead = leads.docs[0]
    expect(lead.acquiredProject).toBe(ready.id)
    expect(lead.currentInterestedProject).toBe(ready.id)
    expect(lead.sourceSlug).toBe(ready.slug)
    await visitor.getByRole('button', { name: 'Send another enquiry' }).click()
    await visitor.screenshot({
      path: info.outputPath('project-marketing-desktop.png'),
      fullPage: true,
    })
    await visitor.setViewportSize({ width: 390, height: 844 })
    await visitor.goto('/')
    await expect(visitor.getByRole('heading', { level: 1 })).toBeVisible()
    expect(
      await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy()
    await visitor.screenshot({
      path: info.outputPath('project-marketing-mobile.png'),
      fullPage: true,
    })
    await admin.request.delete(`/api/leads/${lead.id}`)
  } finally {
    for (const [collection, id] of [
      ['featured-projects', ready.id],
      ['featured-projects', withdrawn.id],
      ['property-listings', listing.id],
      ['marketed-projects', ad.id],
    ])
      await admin.request.delete(`/api/${collection}/${id}`)
  }
}
