import { expect, type Browser, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { baseURL } from './env'

// Browser flow for project funding, advertising allocation, commission distribution and
// CRM repeat-enquiry detection. Arithmetic edge cases are covered by the unit and
// database tests; this checks the screens, forms, permissions and exports end to end.
export async function verifyFinanceFunding(page: Page, browser: Browser) {
  page.setDefaultTimeout(15000)
  const api = async (method: 'post' | 'patch', path: string, data: Record<string, unknown>) => {
    const response = await page.request[method](path, { data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).doc
  }
  const anonymous = await browser.newContext()
  const outsider = await anonymous.newPage()
  for (const route of ['/finance/projects', '/finance/participants', '/finance/accounts', '/finance/ad-charges', '/finance/new/funding'])
    await outsider.goto(route).then(() => expect(outsider.url()).toContain('/admin/login'))
  for (const collection of ['finance-participants', 'finance-funding', 'finance-ad-charges', 'finance-payouts', 'finance-files', 'finance-audit-log'])
    expect([401, 403]).toContain((await outsider.request.get(`/api/${collection}`)).status())
  expect((await outsider.request.get('/finance/export?kind=project-report&project=1')).status()).toBe(401)
  await anonymous.close()

  const media = await (await page.request.get('/api/media?limit=1')).json()
  const project = await api('post', '/api/featured-projects', {
    title: 'Funding E2E Project',
    slug: 'funding-e2e-project',
    builderName: 'Test Builder',
    propertyType: 'Flat',
    location: 'Scheme 33',
    status: 'Pre-launch',
    elevationImages: [{ image: media.docs[0].id }],
  })

  // Participants and an account, through the forms.
  for (const [name, owner] of [
    ['E2E Owner', true],
    ['E2E Investor', false],
  ] as const) {
    await page.goto('/finance/new/participant')
    await page.getByLabel('Name', { exact: true }).fill(name)
    if (owner) await page.getByLabel(/This is me/).check()
    await page.getByRole('button', { name: 'Save entry' }).click()
    await expect(page).toHaveURL(/\/finance\/participants$/)
    await expect(page.getByRole('link', { name })).toBeVisible()
  }
  await page.goto('/finance/new/account')
  await page.getByLabel('Account name').fill('E2E Bank')
  await page.getByLabel(/Opening recorded balance/).fill('1000')
  await page.getByLabel(/Of which: my own money/).fill('400')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(/\/finance\/accounts$/)
  await expect(page.getByRole('row').filter({ hasText: 'E2E Bank' })).toContainText('Rs. 1,000')
  await expect(page.getByRole('row').filter({ hasText: 'Unclassified opening amount' })).toContainText('Rs. 600')

  // Every CMS project appears in Finance automatically.
  await page.goto('/finance/projects')
  await page.getByRole('link', { name: 'Funding E2E Project' }).click()
  await page.getByRole('link', { name: 'Edit funding / commission rules' }).click()
  const funding = page.getByRole('group', { name: /Funding percentages/ })
  await funding.getByLabel('Person').first().selectOption({ label: 'E2E Owner' })
  await funding.getByLabel('Percent').first().fill('50')
  await funding.getByRole('button', { name: '+ Add person' }).click()
  await funding.getByLabel('Person').nth(1).selectOption({ label: 'E2E Investor' })
  await funding.getByLabel('Percent').nth(1).fill('40')
  await expect(funding.getByRole('status')).toContainText('must be exactly 100%')
  await funding.getByLabel('Percent').nth(1).fill('50')
  await expect(funding.getByRole('status')).toContainText('100% ✓')
  const commission = page.getByRole('group', { name: /Default commission/ })
  await commission.getByLabel('Person').first().selectOption({ label: 'E2E Owner' })
  await commission.getByLabel('Percent').first().fill('100')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(new RegExp(`/finance/projects/${project.id}$`))
  await expect(page.getByText('E2E Owner 50% · E2E Investor 50%')).toBeVisible()

  await page.getByRole('link', { name: '+ Add campaign' }).click()
  await page.getByLabel('Campaign name').fill('E2E Launch')
  await page.getByLabel(/Start date and time/).fill('2026-10-01T09:00')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'E2E Launch' })).toContainText('Rs. 5,000')

  // A contribution with a private proof attachment.
  await page.getByRole('link', { name: '+ Record funding' }).click()
  await page.getByLabel('Participant', { exact: true }).selectOption({ label: 'E2E Investor' })
  await page.getByLabel('Amount (PKR)').fill('20000')
  await page.getByLabel(/Receiving \/ paying account/).selectOption({ label: 'E2E Bank' })
  // Payload checks that an uploaded PDF really is one, so attach a genuine PDF.
  const pdf = await PDFDocument.create()
  pdf.addPage()
  await page.getByLabel(/Proof attachments/).setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) })
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(new RegExp(`/finance/projects/${project.id}$`))
  const files = await (await page.request.get('/api/finance-files?limit=1&depth=0')).json()
  expect(files.docs[0].filename).not.toContain('receipt')
  expect(files.docs[0].mimeType).toBe('application/pdf')

  // An advertising charge, with the allocation previewed before saving.
  await page.goto('/finance/new/ad-charge')
  await page.getByLabel('Bank or card account debited').selectOption({ label: 'E2E Bank' })
  await page.getByLabel('Actual bank debit (PKR)').fill('10800')
  await page.getByLabel('Campaign').selectOption({ label: 'Funding E2E Project · E2E Launch' })
  await page.getByLabel('Meta amount').fill('10000')
  await expect(page.getByRole('row', { name: /^Total Rs/ })).toContainText('Rs. 800')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(/\/finance\/ad-charges$/)
  await expect(page.getByText('E2E Owner 50% Rs. 5,400 · E2E Investor 50% Rs. 5,400')).toBeVisible()
  await page.goto(`/finance/projects/${project.id}`)
  const owner = page.getByRole('row').filter({ hasText: 'E2E Owner' }).first()
  await expect(owner).toContainText('Rs. -5,400')
  await expect(owner).toContainText('Shortfall')
  await expect(page.getByRole('row').filter({ hasText: 'E2E Investor' }).first()).toContainText('Rs. 14,600')
  const report = await page.request.get(`/finance/export?kind=project-report&project=${project.id}`)
  expect(report.ok()).toBeTruthy()
  const csv = await report.text()
  expect(csv).toContain('Daily Meta amounts and allocated additional charges')
  expect(csv).toContain('"800"')

  // A deal snapshots the project's default split; a receipt makes it payable.
  const accounts = await (await page.request.get('/api/finance-accounts?depth=0')).json()
  const bank = accounts.docs.find((a: { name: string }) => a.name === 'E2E Bank').id
  const deal = await api('post', '/api/finance-deals', {
    clientName: 'Funding E2E Buyer',
    project: project.id,
    unitType: '2 Bed',
    dateClosed: '2026-10-10T00:00:00+05:00',
    saleValue: 20000000,
    fixedCommission: 300000,
    expectedPaymentDate: '2026-11-01T00:00:00+05:00',
    commissionMode: 'custom',
    commissionSplit: [{ recipientName: 'E2E Owner', percent: 100 }],
  })
  await api('post', '/api/finance-receipts', { deal: deal.id, date: '2026-10-20', amount: 100000, nextExpectedDate: '2026-12-01', account: bank })
  await page.goto(`/finance/deals/${deal.id}`)
  const card = (label: string) => page.locator('.finance-card').filter({ has: page.locator('span', { hasText: label }) }).locator('strong')
  await expect(card('Distributable to date')).toHaveText('Rs. 100,000')
  await expect(card('Outstanding commission')).toHaveText('Rs. 200,000')
  await page.getByRole('link', { name: 'Record payout' }).click()
  await page.getByLabel('Amount paid (PKR)').fill('100000')
  await page.getByLabel('Paid from account').selectOption({ label: 'E2E Bank' })
  await page.getByLabel('Payment method').fill('Bank transfer')
  await page.getByLabel('Reference', { exact: true }).fill('E2E-PAYOUT')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page).toHaveURL(new RegExp(`/finance/deals/${deal.id}$`))
  await expect(card('Unpaid entitlements')).toHaveText('Rs. 0')
  await expect(page.getByRole('row').filter({ hasText: 'E2E-PAYOUT' })).toBeVisible()

  // Repeat enquiries: same number in another format warns, then can be saved deliberately.
  const lead = (phone: string, confirmDuplicate = false) =>
    page.request.post('/api/crm/leads', {
      headers: { Origin: baseURL },
      data: { name: 'Repeat Buyer', phone, project: project.id, source: 'whatsapp', confirmDuplicate },
    })
  expect((await lead('03001112233')).status()).toBe(201)
  const warning = await lead('+92 300 1112233')
  expect(warning.status()).toBe(409)
  expect((await warning.json()).duplicates).toHaveLength(1)
  expect((await lead('03001112234')).status(), 'same name, different number').toBe(201)
  expect((await lead('923001112233', true)).status()).toBe(201)
  await page.goto('/leads-dashboard/duplicates')
  await expect(page.getByRole('heading', { name: '+923001112233 · 2 records' })).toBeVisible()
  await page.goto('/leads-dashboard?q=1112233')
  await expect(page.getByText('Repeat enquiry · 2').first()).toBeVisible()
}
