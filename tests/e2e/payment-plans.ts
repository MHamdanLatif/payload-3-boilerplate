import { expect, type Page, type TestInfo } from '@playwright/test'
import { DEFAULT_PAYMENT_HEADS } from '../../src/lib/payment-heads'
import { initialAdminPlan } from '../../src/lib/admin-payment-plan'

export async function verifyPaymentPlans(adminPage: Page, publicPage: Page, info: TestInfo) {
  const media = await (await adminPage.request.get('/api/media?limit=1')).json()
  const response = await adminPage.request.post('/api/featured-projects', {
    data: {
      title: 'Payment Plan E2E',
      slug: 'payment-plan-e2e',
      builderName: 'Test Builder',
      propertyType: 'Flat',
      location: 'Scheme 33',
      status: 'Pre-launch',
      elevationImages: [{ image: media.docs[0].id }],
      unitTypes: [
        { name: 'Type A', type: '2 Bed Lounge', rooms: 3, price: 10000000 },
        { name: 'Type B', type: '2 Bed Lounge', rooms: 3, price: 12000000 },
      ],
      paymentPlan: {
        enabled: true,
        totalDurationMonths: 36,
        downPaymentMinPct: 10,
        downPaymentMaxPct: 50,
        possessionPct: 5,
        paymentHeads: DEFAULT_PAYMENT_HEADS.filter(
          (h) => !['Grey Structure', 'Finishing'].includes(h.category),
        ).map((h) => ({ ...h, enabled: true })),
      },
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const project = (await response.json()).doc

  await publicPage.goto('/internal/payment-plans')
  await expect(publicPage).toHaveURL(/\/admin\/login/)
  expect(
    (await publicPage.request.post('/api/admin/payment-plan/pdf', { data: {} })).status(),
  ).toBe(401)
  expect((await publicPage.request.post('/api/payment-plan-leads', { data: {} })).status()).toBe(
    403,
  )

  await adminPage.goto('/internal/payment-plans')
  await expect(adminPage.getByRole('heading', { name: 'Payment Plan Studio' })).toBeVisible()
  await adminPage.getByLabel('Project', { exact: true }).selectOption(String(project.id))
  await adminPage.getByLabel('Unit', { exact: true }).selectOption(project.unitTypes[0].id)
  await expect(adminPage.getByTestId('final-price')).toHaveText('PKR 10,000,000')
  await adminPage.getByRole('button', { name: 'Add extra charge' }).click()
  await adminPage.getByLabel('Charge 1 name').fill('Parking')
  await adminPage.getByLabel('Charge 1 treatment').selectOption('separate')
  await adminPage.getByLabel('Charge 1 amount (PKR)').fill('500000')
  await adminPage.getByLabel('Charge 1 due month').fill('6')
  await expect(adminPage.getByTestId('regular-price')).toHaveText('PKR 10,000,000')
  await expect(adminPage.getByTestId('final-price')).toHaveText('PKR 10,500,000')
  await expect(adminPage.getByTestId('remaining')).toHaveText('PKR 0')
  await expect(adminPage.getByRole('row').filter({ hasText: 'Parking' })).toContainText('Month 6')
  await adminPage.getByRole('button', { name: 'Add discount' }).click()
  await adminPage.getByLabel('Discount 1 amount (PKR)').fill('100000')
  await expect(adminPage.getByTestId('final-price')).toHaveText('PKR 10,400,000')
  await adminPage.getByRole('button', { name: 'Add payment head' }).click()
  const added = adminPage.getByTestId('payment-head').last()
  await added.getByRole('textbox').fill('Documentation')
  await added.getByRole('button', { name: 'Remove head' }).click()
  const before = await (await adminPage.request.get('/api/leads?limit=0')).json()
  const downloadPromise = adminPage.waitForEvent('download')
  await adminPage.getByRole('button', { name: 'Export branded PDF' }).click()
  const download = await downloadPromise
  await download.saveAs(info.outputPath('admin-payment-plan.pdf'))
  expect(await download.failure()).toBeNull()
  const after = await (await adminPage.request.get('/api/leads?limit=0')).json()
  expect(after.totalDocs).toBe(before.totalDocs)
  await adminPage.screenshot({ path: info.outputPath('studio-desktop.png'), fullPage: true })
  await adminPage.setViewportSize({ width: 390, height: 844 })
  await adminPage.screenshot({ path: info.outputPath('studio-mobile.png'), fullPage: true })
  expect(
    await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await adminPage.setViewportSize({ width: 1280, height: 900 })
  const invalid = initialAdminPlan(project, project.unitTypes[0].id)
  invalid.basePrice = 1
  expect(
    (
      await adminPage.request.post('/api/admin/payment-plan/pdf', { data: { plan: invalid } })
    ).status(),
  ).toBe(400)

  await publicPage.goto(`/projects/${project.slug}`)
  await publicPage.getByLabel('Unit Type', { exact: true }).selectOption(project.unitTypes[1].id)
  const monthly = publicPage.getByLabel('Monthly amount', { exact: true })
  const displayed = await monthly.inputValue()
  await publicPage.getByLabel('Monthly amount method').selectOption('entered')
  await expect(monthly).toHaveValue(displayed)
  await publicPage.getByLabel('Calculate my down payment from the installment amounts.').check()
  await monthly.fill('170000')
  await expect(publicPage.getByRole('button', { name: 'Download PDF Plan' })).toBeEnabled()
  await publicPage.getByRole('button', { name: 'Download PDF Plan' }).click()
  await expect(publicPage.getByRole('dialog')).toBeVisible()
  await publicPage.getByPlaceholder("As you'd like the plan addressed").fill('E2E Buyer')
  await publicPage.getByPlaceholder('3XX XXXXXXX').fill('+923001234567')
  const requestPromise = publicPage.waitForRequest(
    (r) => r.url().endsWith('/api/payment-plan/pdf') && r.method() === 'POST',
  )
  const publicDownloadPromise = publicPage.waitForEvent('download')
  await publicPage.getByRole('button', { name: 'Download PDF', exact: true }).click()
  const request = await requestPromise
  const publicBody = request.postDataJSON()
  expect(publicBody.dpMode).toBe('auto')
  expect(publicBody.selectedUnitKey).toBe(project.unitTypes[1].id)
  const publicDownload = await publicDownloadPromise
  await publicDownload.saveAs(info.outputPath('public-payment-plan.pdf'))
  expect(await publicDownload.failure()).toBeNull()
  await publicPage.screenshot({ path: info.outputPath('public-calculator.png'), fullPage: true })
  const audit = await (
    await adminPage.request.get('/api/payment-plan-leads?limit=1&sort=-createdAt')
  ).json()
  expect(audit.docs[0].totalPrice).toBe(12000000)
  expect(audit.docs[0].downPaymentAmount).toBe(5280000)
  expect(
    (
      await publicPage.request.post('/api/payment-plan/pdf', {
        data: { ...publicBody, dpMode: 'fixed', downPaymentPct: 80 },
      })
    ).status(),
  ).toBe(400)
}
