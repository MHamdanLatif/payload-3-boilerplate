import { expect, type Page } from '@playwright/test'

export async function verifyMarketedFinance(page: Page, media: number) {
  const create = async (collection: string, data: Record<string, unknown>) => {
    const response = await page.request.post(`/api/${collection}`, { data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).doc
  }
  const marketed = await create('marketed-projects', {
    title: 'Campaign Only E2E', slug: 'campaign-only-e2e', builderName: 'Test Builder',
    location: 'Scheme 33', status: 'Pre-launch', elevationImages: [{ image: media }],
  })
  const records = await (await page.request.get(`/api/finance-projects?where[marketedProject][equals]=${marketed.id}&depth=0`)).json()
  const project = records.docs[0]
  expect(project.featuredProject).toBeFalsy()
  await page.goto('/finance/projects')
  await page.getByRole('link').filter({ hasText: 'Campaign Only E2E' }).click()
  await expect(page).toHaveURL(new RegExp(`/finance/projects/${project.id}$`))
  await page.getByRole('link', { name: 'Edit funding / commission rules' }).click()
  // One funder is sufficient; the commission defaults remain optional.
  const funding = page.getByRole('group', { name: /Funding percentages/ })
  await funding.getByLabel('Person').first().selectOption({ label: 'E2E Owner' })
  await funding.getByLabel('Percent').first().fill('100')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(new RegExp(`/finance/projects/${project.id}$`))
  await page.getByRole('link', { name: '+ Add campaign' }).click()
  await page.getByLabel('Campaign name').fill('Paid Only Launch')
  await page.getByLabel(/Start date and time/).fill('2026-10-01T09:00')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await page.getByRole('link', { name: '+ Record funding' }).click()
  await page.getByLabel('Participant', { exact: true }).selectOption({ label: 'E2E Owner' })
  await page.getByLabel('Amount (PKR)').fill('2000')
  await page.getByLabel(/Receiving \/ paying account/).selectOption({ label: 'E2E Bank' })
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(new RegExp(`/finance/projects/${project.id}$`))
  await page.goto('/finance/new/ad-charge')
  await page.getByLabel('Bank or card account debited').selectOption({ label: 'E2E Bank' })
  await page.getByLabel('Actual bank debit (PKR)').fill('1080')
  await page.getByLabel('Campaign').selectOption({ label: 'Campaign Only E2E · Paid Only Launch' })
  await page.getByLabel('Meta amount').fill('1000')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(/\/finance\/ad-charges$/)
  await page.goto(`/finance/projects/${project.id}`)
  await expect(page.locator('.finance-card').filter({ hasText: 'Advertising cash remaining' })).toContainText('Rs. 920')
  const report = await page.request.get(`/finance/export?kind=project-report&project=${project.id}`)
  expect(report.ok()).toBeTruthy()
  expect(await report.text()).toContain('Paid Only Launch')
  const pdf = await page.request.get(`/finance/export?kind=project-report&project=${project.id}&format=pdf`)
  expect(pdf.ok()).toBeTruthy()
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  const featured = await (await page.request.get('/api/featured-projects?where[slug][equals]=campaign-only-e2e')).json()
  expect(featured.totalDocs).toBe(0)
  const publicResponse = await page.request.get('/campaign-only-e2e')
  expect(publicResponse.ok()).toBeTruthy()
  expect(await publicResponse.text()).toMatch(/noindex/)
  expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain('/campaign-only-e2e')
}
