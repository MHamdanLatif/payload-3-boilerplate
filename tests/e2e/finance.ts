import { expect, type Browser, type Page } from '@playwright/test'
import { createHmac } from 'node:crypto'
import { payloadSecret } from './env'

export async function verifyFinance(page: Page, browser: Browser) {
  const projects = await (await page.request.get('/api/featured-projects?limit=1&depth=0')).json()
  let project = projects.docs[0]?.id
  if (!project) {
    const media = await (await page.request.get('/api/media?limit=1')).json()
    const response = await page.request.post('/api/featured-projects', {
      data: {
        title: 'Finance Test Project',
        slug: 'finance-test-project',
        builderName: 'Test Builder',
        propertyType: 'Flat',
        location: 'Scheme 33',
        status: 'Pre-launch',
        elevationImages: [{ image: media.docs[0].id }],
      },
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    project = (await response.json()).doc.id
  }
  const create = async (collection: string, data: Record<string, unknown>) => {
    const response = await page.request.post(`/api/${collection}`, { data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).doc
  }
  const deal = await create('finance-deals', {
    clientName: 'Finance Scenario A–G',
    contact: '03001234567',
    project,
    unitNumber: 'F-101',
    dateClosed: '2026-09-10T00:00:00+05:00',
    saleValue: 20000000,
    bookingPercentage: 10,
    requiredBookingPercentage: 20,
    calculationType: 'percentage',
    commissionRate: 2,
    trigger: 'threshold',
    createdBy: 99999,
    entryKey: 'finance-e2e-deal',
  })
  const me = (await (await page.request.get('/api/users/me')).json()).user
  expect(deal.createdBy === me.id || deal.createdBy.id === me.id).toBeTruthy()
  const anonymous = await browser.newContext(),
    publicPage = await anonymous.newPage()
  for (const route of [
    '/finance',
    '/finance/deals',
    `/finance/deals/${deal.id}`,
    '/finance/expenses',
    '/finance/reports',
    '/finance/entry/deals',
  ]) {
    await publicPage.goto(route)
    expect(publicPage.url()).toContain('/admin/login')
    await expect(publicPage.getByText('Finance Scenario A–G')).toHaveCount(0)
  }
  const collections = [
    'finance-deals',
    'finance-receipts',
    'finance-receivables',
    'finance-expenses',
  ]
  for (const collection of collections) {
    expect([401, 403]).toContain((await publicPage.request.get(`/api/${collection}`)).status())
    expect([401, 403]).toContain(
      (await publicPage.request.post(`/api/${collection}`, { data: { amount: 1 } })).status(),
    )
  }
  expect([401, 403]).toContain(
    (await publicPage.request.get(`/api/finance-deals/${deal.id}?depth=5`)).status(),
  )
  expect((await publicPage.request.get('/finance/export?kind=deals')).status()).toBe(401)
  const outsider = await create('users', {
    email: 'finance-outsider@example.com',
    password: 'FinanceTest123!',
    name: 'No finance permission',
    financeAccess: false,
    financeAdmin: false,
  })
  const denied = await browser.newContext(),
    deniedPage = await denied.newPage()
  expect(
    (
      await deniedPage.request.post('/api/users/login', {
        data: { email: outsider.email, password: 'FinanceTest123!' },
      })
    ).ok(),
  ).toBeTruthy()
  await deniedPage.request.patch(`/api/users/${outsider.id}`, {
    data: { financeAccess: true, financeAdmin: true },
  })
  const outsiderAfter = (await (await deniedPage.request.get('/api/users/me')).json()).user
  expect(outsiderAfter.financeAccess).toBeFalsy()
  expect(outsiderAfter.financeAdmin).toBeFalsy()
  expect(
    (
      await deniedPage.request.patch(`/api/users/${me.id}`, {
        data: { password: 'attempted-takeover' },
      })
    ).ok(),
  ).toBeFalsy()
  for (const collection of collections) {
    expect((await deniedPage.request.get(`/api/${collection}`)).status()).toBe(403)
    expect(
      (await deniedPage.request.post(`/api/${collection}`, { data: { amount: 1 } })).status(),
    ).toBe(403)
  }
  expect((await deniedPage.request.get(`/api/finance-deals/${deal.id}`)).status()).toBe(403)
  expect(
    (
      await deniedPage.request.patch(`/api/finance-deals/${deal.id}`, {
        data: { bookingPercentage: 100 },
      })
    ).status(),
  ).toBe(403)
  expect((await deniedPage.request.get('/finance/export?kind=deals')).status()).toBe(403)
  await deniedPage.goto('/finance')
  await expect(deniedPage.getByRole('heading', { name: 'Finance', exact: true })).toHaveCount(0)
  await expect(deniedPage.getByText('Finance Scenario A–G')).toHaveCount(0)
  await page.goto(`/finance/deals/${deal.id}`)
  const card = (label: string) =>
    page
      .locator('.finance-card')
      .filter({ has: page.locator('span', { hasText: label }) })
      .locator('strong')
  await expect(card('Conditional commission')).toHaveText('Rs. 400,000')
  await expect(card('Eligible amount')).toHaveText('Rs. 0')
  expect(
    (
      await page.request.patch(`/api/finance-deals/${deal.id}`, { data: { bookingPercentage: 20 } })
    ).ok(),
  ).toBeTruthy()
  await page.reload()
  await expect(card('Outstanding commission')).toHaveText('Rs. 400,000')
  const schedule = await create('finance-receivables', {
    deal: deal.id,
    date: '2026-09-15T00:00:00+05:00',
    amount: 400000,
  })
  await page.reload()
  await expect(page.getByText('Overdue', { exact: true })).toBeVisible()
  const receipt = await create('finance-receipts', {
    deal: deal.id,
    receivable: schedule.id,
    date: '2026-10-05T00:00:00+05:00',
    amount: 150000,
    entryKey: 'finance-e2e-first-payment',
  })
  await page.reload()
  await expect(card('Commission received')).toHaveText('Rs. 150,000')
  await expect(card('Outstanding commission')).toHaveText('Rs. 250,000')
  expect(
    (
      await page.request.post('/api/finance-receipts', {
        data: {
          deal: deal.id,
          date: '2026-10-05',
          amount: 150000,
          entryKey: 'finance-e2e-first-payment',
        },
      })
    ).ok(),
  ).toBeFalsy()
  expect(
    (await page.request.patch(`/api/finance-receipts/${receipt.id}`, { data: { amount: 2 } })).ok(),
  ).toBeFalsy()
  expect((await page.request.delete(`/api/finance-receipts/${receipt.id}`)).status()).toBe(403)
  for (const amount of [-1, 0.001])
    expect(
      (
        await page.request.post('/api/finance-receipts', {
          data: { deal: deal.id, date: '2026-10-05', amount },
        })
      ).ok(),
    ).toBeFalsy()
  expect(
    (
      await page.request.patch(`/api/finance-deals/${deal.id}`, {
        data: { bookingPercentage: 101 },
      })
    ).ok(),
  ).toBeFalsy()
  expect(
    (
      await page.request.post('/api/finance-expenses', {
        data: { date: '2026-10-05', amount: -1, category: 'Meta Ads', description: 'Invalid' },
      })
    ).ok(),
  ).toBeFalsy()
  await create('finance-receipts', {
    deal: deal.id,
    receivable: schedule.id,
    date: '2026-10-10T00:00:00+05:00',
    amount: 250000,
  })
  await page.reload()
  await expect(card('Commission received')).toHaveText('Rs. 400,000')
  await expect(card('Outstanding commission')).toHaveText('Rs. 0')
  await expect(page.getByText('Fully Received', { exact: true })).toBeVisible()
  await create('finance-expenses', {
    date: '2026-10-12T00:00:00+05:00',
    amount: 100000,
    category: 'Meta Ads',
    description: 'October campaign',
    project,
  })
  await page.goto('/finance?period=month&month=2026-09')
  await expect(card('Commission generated')).toHaveText('Rs. 400,000')
  await expect(card('Commission received')).toHaveText('Rs. 0')
  await page.goto('/finance?period=month&month=2026-10')
  await expect(card('Commission received')).toHaveText('Rs. 400,000')
  await expect(card('Expenses')).toHaveText('Rs. 100,000')
  await expect(card('Net cash flow')).toHaveText('Rs. 300,000')
  for (const kind of ['deals', 'receipts', 'receivables', 'expenses']) {
    const csv = await page.request.get(`/finance/export?kind=${kind}`)
    expect(csv.ok()).toBeTruthy()
    expect(csv.headers()['cache-control']).toContain('no-store')
    expect((await csv.text()).length).toBeGreaterThan(100)
  }
  await page.goto('/finance/reports?period=month&month=2026-10')
  await expect(page.getByRole('heading', { name: 'Project profitability' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/finance')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await page.screenshot({ path: 'test-results/finance-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: 'test-results/finance-desktop.png', fullPage: true })
  // Expired signed token must not yield records, even for an authorized user ID.
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(
    JSON.stringify({ id: me.id, collection: 'users', email: me.email, exp: 1 }),
  ).toString('base64url')
  const token = `${head}.${body}.${createHmac('sha256', payloadSecret).update(`${head}.${body}`).digest('base64url')}`
  expect([401, 403]).toContain(
    (
      await publicPage.request.get('/api/finance-deals', {
        headers: { Authorization: `JWT ${token}` },
      })
    ).status(),
  )
  await anonymous.addCookies([{ name: 'payload-token', value: token, url: page.url() }])
  await publicPage.goto(`/finance/deals/${deal.id}`)
  expect(publicPage.url()).toContain('/admin/login')
  // Correcting a payment by void preserves its ledger row and recomputes totals.
  expect(
    (
      await page.request.patch(`/api/finance-receipts/${receipt.id}`, { data: { voided: true } })
    ).ok(),
  ).toBeFalsy()
  expect(
    (
      await page.request.patch(`/api/finance-receipts/${receipt.id}`, {
        data: { voided: true, voidReason: 'E2E correction' },
      })
    ).ok(),
  ).toBeTruthy()
  await page.goto(`/finance/deals/${deal.id}`)
  await expect(card('Commission received')).toHaveText('Rs. 250,000')
  await expect(card('Outstanding commission')).toHaveText('Rs. 150,000')
  await page.goto('/finance/entry/deals')
  await page.getByLabel('Client name', { exact: true }).fill('Browser form buyer')
  await page.locator('select[name="project"]').selectOption(String(project))
  await page.getByLabel('Unit number', { exact: true }).fill('FORM-1')
  await page.getByLabel('Sale value (PKR)', { exact: true }).fill('10000000')
  await page.locator('select[name="calculationType"]').selectOption('fixed')
  await page.getByLabel('Fixed commission (PKR)', { exact: true }).fill('250000')
  await page.locator('select[name="trigger"]').selectOption('booking')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(/\/finance\/deals\/\d+$/)
  await expect(card('Eligible amount')).toHaveText('Rs. 250,000')
  await page.getByRole('link', { name: '+ Record Payment', exact: true }).click()
  await page.getByLabel('Amount (PKR)', { exact: true }).fill('50000')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(/\/finance\/deals\/\d+$/)
  await expect(card('Outstanding commission')).toHaveText('Rs. 200,000')
  await page.getByRole('link', { name: '+ Expected Payment', exact: true }).click()
  await page.getByLabel('Amount (PKR)', { exact: true }).fill('200000')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(/\/finance\/deals\/\d+$/)
  await page.getByRole('link', { name: '+ Add Expense', exact: true }).click()
  await page.getByLabel('Amount (PKR)', { exact: true }).fill('500')
  await page.getByLabel('Description', { exact: true }).fill('Browser expense')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(/\/finance\/expenses$/)
  await expect(page.getByText('Browser expense', { exact: true })).toBeVisible()
  await anonymous.close()
  await denied.close()
}
