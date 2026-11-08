import { expect, type Page } from '@playwright/test'

export async function verifyMarketingPageCopy(admin: Page, visitor: Page, projectID: number) {
  const type = '4 Bed Lounge / 3 Bed Drawing'
  const update = await admin.request.patch(`/api/featured-projects/${projectID}`, {
    data: {
      summary: 'Copied campaign summary',
      unitTypes: [
        { name: 'Type A', type, rooms: 5, price: 12000000, areaSqFt: 1800, isDuplex: true },
        { name: 'Sold out', type: '1 Bed Lounge', rooms: 2, price: 9000000, soldOut: true },
      ],
    },
  })
  expect(update.ok(), await update.text()).toBeTruthy()
  expect((await visitor.request.post(`/api/featured-projects/${projectID}/marketing-page`)).status()).toBe(401)
  await visitor.goto(`/properties?unitType=${encodeURIComponent(type)}`)
  await expect(visitor.getByRole('heading', { name: 'Ready Builder E2E' })).toBeVisible()
  await admin.goto(`/admin/collections/featured-projects/${projectID}`)
  await admin.getByRole('button', { name: 'Create marketing page', exact: true }).click()
  await expect(admin).toHaveURL(/\/admin\/collections\/marketed-projects\/\d+/)
  const id = admin.url().split('/').pop()!
  try {
    const copy = await (await admin.request.get(`/api/marketed-projects/${id}?depth=0`)).json()
    expect(copy.active).toBe(false)
    expect(copy.linkedProject).toBe(projectID)
    expect(copy.summary).toBe('Copied campaign summary')
    expect(copy.elevationImages).toHaveLength(1)
    expect(copy.availableUnits).toHaveLength(1)
    expect(copy.availableUnits[0]).toMatchObject({ name: 'Type A', type: `${type} (Duplex)`, areaSqFt: 1800 })
    expect((await visitor.request.get(`/${copy.slug}`)).status()).toBe(404)
    const edit = await admin.request.patch(`/api/marketed-projects/${id}`, {
      data: { summary: 'Independent marketing copy', offerNote: 'Campaign-specific offer', active: true },
    })
    expect(edit.ok(), await edit.text()).toBeTruthy()
    await visitor.goto(`/${copy.slug}`)
    await expect(visitor.getByText('Independent marketing copy')).toBeVisible()
    await expect(visitor.getByText('Campaign-specific offer')).toBeVisible()
    const again = await admin.request.post(`/api/featured-projects/${projectID}/marketing-page`)
    expect((await again.json()).id).toBe(Number(id))
    const saved = await (await admin.request.get(`/api/marketed-projects/${id}`)).json()
    expect(saved.summary).toBe('Independent marketing copy')
    const source = await (await admin.request.get(`/api/featured-projects/${projectID}`)).json()
    expect(source.summary).toBe('Copied campaign summary')
  } finally {
    await admin.request.delete(`/api/marketed-projects/${id}`)
  }
}
