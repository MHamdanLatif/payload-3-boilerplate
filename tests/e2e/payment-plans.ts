import { expect, type Page, type TestInfo } from '@playwright/test'
import { DEFAULT_PAYMENT_HEADS } from '../../src/lib/payment-heads'
import { initialAdminPlan } from '../../src/lib/admin-payment-plan'
import { PDFDocument } from 'pdf-lib'

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
        {
          name: 'Type A',
          type: '2 Bed Lounge',
          rooms: 3,
          price: 10000000,
          flatLayout: media.docs[0].id,
        },
        { name: 'Type B', type: '2 Bed Lounge', rooms: 3, price: 12000000 },
        { name: 'Type C', type: '3 Bed Lounge', rooms: 4, price: 15000000, loanAmount: 2000000 },
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
  await adminPage.getByRole('button', { name: 'Download complete PDF' }).click()
  const download = await downloadPromise
  await download.saveAs(info.outputPath('admin-payment-plan.pdf'))
  expect(await download.failure()).toBeNull()
  const summaryPromise = adminPage.waitForEvent('download')
  await adminPage.getByRole('button', { name: 'Download summarized PDF' }).click()
  await (await summaryPromise).saveAs(info.outputPath('admin-payment-plan-summary.pdf'))
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
  // A CMS loan is optional, read-only and held outside the scheduled payments.
  await expect(adminPage.getByRole('switch', { name: 'Include loan' })).toHaveCount(0)
  adminPage.once('dialog', (dialog) => dialog.accept())
  await adminPage.getByLabel('Unit', { exact: true }).selectOption(project.unitTypes[2].id)
  const loanSwitch = adminPage.getByRole('switch', { name: 'Include loan' })
  await expect(loanSwitch).not.toBeChecked()
  await expect(adminPage.getByTestId('loan-amount')).toHaveCount(0)
  await loanSwitch.check()
  await expect(adminPage.getByTestId('loan-amount')).toHaveText('PKR 2,000,000')
  await expect(adminPage.getByTestId('final-price')).toHaveText('PKR 15,000,000')
  await expect(adminPage.getByTestId('remaining')).toHaveText('PKR 0')
  const loanRequest = adminPage.waitForRequest((r) =>
    r.url().endsWith('/api/admin/payment-plan/pdf'),
  )
  const loanDownload = adminPage.waitForEvent('download')
  await adminPage.getByRole('button', { name: 'Download complete PDF' }).click()
  expect((await loanRequest).postDataJSON().plan.includeLoan).toBe(true)
  expect(await (await loanDownload).failure()).toBeNull()

  // CRM schedules persist settings, preserve revisions, and remain private.
  const leadResponse = await adminPage.request.post('/api/leads', {
    data: {
      name: 'Schedule Client',
      phone: '03001234567',
      sourceKind: 'listing',
      currentInterestedProject: project.id,
    },
  })
  expect(leadResponse.ok()).toBeTruthy()
  const lead = (await leadResponse.json()).doc
  const scheduleURL = `/api/crm/leads/${lead.id}/schedules`
  expect((await publicPage.request.post(scheduleURL, { data: {} })).status()).toBe(401)
  expect((await publicPage.request.get('/api/schedule-revisions')).status()).toBe(403)
  expect((await adminPage.request.post('/api/lead-schedules', { data: {} })).status()).toBe(403)
  await adminPage.goto(`/leads-dashboard/${lead.id}`)
  await adminPage.getByRole('link', { name: 'Make schedule' }).click()
  await expect(adminPage.getByLabel('Project', { exact: true })).toHaveValue(String(project.id))
  await adminPage.getByLabel('Unit', { exact: true }).selectOption(project.unitTypes[0].id)
  await adminPage.getByLabel('Schedule name', { exact: true }).fill('Type A - discussed terms')
  await adminPage.getByLabel('Installment duration (months)').fill('60')
  await adminPage.getByLabel('Installments start (months after signing)').fill('2')
  await expect(adminPage.getByLabel('Prepared for (optional)')).toHaveValue(lead.name)
  await adminPage.getByLabel('Discussion / revision note').fill('Initial discussion')
  await adminPage.getByRole('button', { name: 'Save schedule', exact: true }).click()
  await expect(adminPage.getByRole('status')).toContainText('Saved revision 1.')
  const savedURL = adminPage.url()
  const scheduleId = Number(savedURL.split('/').pop())
  await adminPage.getByRole('button', { name: 'Save schedule', exact: true }).click()
  await expect(adminPage.getByRole('status')).toContainText('Saved revision 1.')
  const revision1 = (
    await (
      await adminPage.request.get(
        `/api/schedule-revisions?where[schedule][equals]=${scheduleId}&depth=0`,
      )
    ).json()
  ).docs[0]
  // New schedules use the current quarterly/half-yearly/yearly timing.
  expect(revision1.settings.cadence).toBe(2)
  await adminPage.getByRole('button', { name: 'Add discount' }).click()
  await adminPage.getByLabel('Discount 1 amount (PKR)').fill('100000')
  await adminPage.getByLabel('Discussion / revision note').fill('Negotiated a discount')
  await adminPage.getByRole('button', { name: 'Save schedule', exact: true }).click()
  await expect(adminPage.getByRole('status')).toContainText('Saved revision 2.')
  await adminPage.reload()
  await expect(adminPage.getByTestId('final-price')).toHaveText('PKR 9,900,000')
  await expect(adminPage.getByLabel('Installments start (months after signing)')).toHaveValue('2')
  await adminPage.getByRole('link', { name: 'View revision history' }).click()
  await adminPage.getByRole('link', { name: 'Open revision 1', exact: true }).click()
  await expect(adminPage.getByTestId('final-price')).toHaveText('PKR 10,000,000')
  await expect(adminPage.getByLabel('Discussion / revision note')).toHaveValue('Initial discussion')
  // Revision notes are internal and are never sent for a client PDF.
  const noteRequest = adminPage.waitForRequest((r) =>
    r.url().endsWith('/api/admin/payment-plan/pdf'),
  )
  const noteDownload = adminPage.waitForEvent('download')
  await adminPage.getByRole('button', { name: 'Download summarized PDF' }).click()
  expect((await noteRequest).postData()).not.toContain('Initial discussion')
  expect(await (await noteDownload).failure()).toBeNull()
  const schedule = await (await adminPage.request.get(`/api/lead-schedules/${scheduleId}`)).json()
  const origin = new URL(adminPage.url()).origin
  const stale = await adminPage.request.post(scheduleURL, {
    headers: { origin },
    data: {
      plan: revision1.settings,
      buyer: { name: lead.name, phone: lead.phone },
      title: schedule.title,
      note: 'Stale edit',
      entryKey: schedule.entryKey,
      expectedRevision: 1,
    },
  })
  expect(stale.status()).toBe(409)
  const count = await (
    await adminPage.request.get(
      `/api/schedule-revisions?where[schedule][equals]=${scheduleId}&limit=1`,
    )
  ).json()
  expect(count.totalDocs).toBe(2)
  // A forged loan amount is replaced with the CMS unit's loan when saving.
  const loanPlan = {
    ...initialAdminPlan(project, project.unitTypes[2].id),
    includeLoan: true,
    loanAmount: 1,
  }
  const loanSave = await adminPage.request.post(scheduleURL, {
    headers: { origin },
    data: {
      plan: loanPlan,
      buyer: { name: lead.name, phone: lead.phone },
      title: 'Type C - with loan',
      note: '',
      entryKey: crypto.randomUUID(),
      expectedRevision: 0,
    },
  })
  expect(loanSave.ok(), await loanSave.text()).toBeTruthy()
  const loanRevision = (
    await (
      await adminPage.request.get(
        `/api/schedule-revisions?where[schedule][equals]=${(await loanSave.json()).id}&depth=0`,
      )
    ).json()
  ).docs[0]
  expect(loanRevision.settings.includeLoan).toBe(true)
  expect(loanRevision.settings.loanAmount).toBe(2000000)
  expect(
    (
      await adminPage.request.post(`/api/crm/leads/999999999/schedules`, {
        headers: { origin },
        data: {
          plan: loanPlan,
          buyer: { name: lead.name, phone: lead.phone },
          title: 'Missing client',
          note: '',
          entryKey: crypto.randomUUID(),
          expectedRevision: 0,
        },
      })
    ).status(),
  ).toBe(404)
  await adminPage.setViewportSize({ width: 390, height: 844 })
  await adminPage.screenshot({ path: info.outputPath('crm-schedule-mobile.png'), fullPage: true })
  expect(
    await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await adminPage.setViewportSize({ width: 1280, height: 900 })
  // A PDF layout is appended intact, alongside image layout coverage above.
  const layout = await PDFDocument.create()
  layout.addPage().drawText('E2E unit layout')
  const uploaded = await adminPage.request.post('/api/media', {
    multipart: {
      file: {
        name: 'e2e-unit-layout.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(await layout.save()),
      },
      _payload: JSON.stringify({ alt: 'Unit layout PDF' }),
    },
  })
  expect(uploaded.ok(), await uploaded.text()).toBeTruthy()
  const pdfMedia = (await uploaded.json()).doc
  const patched = await adminPage.request.patch(`/api/featured-projects/${project.id}`, {
    data: {
      unitTypes: project.unitTypes.map((u, i) => ({
        ...u,
        flatLayout: i === 0 ? pdfMedia.id : u.flatLayout,
      })),
    },
  })
  expect(patched.ok()).toBeTruthy()
  const exported = await adminPage.request.post('/api/admin/payment-plan/pdf', {
    data: {
      plan: revision1.settings,
      buyer: { name: lead.name, phone: lead.phone },
      format: 'summary',
    },
  })
  expect(exported.ok(), exported.ok() ? '' : await exported.text()).toBeTruthy()
  const parsed = await PDFDocument.load(await exported.body())
  expect(parsed.getPageCount()).toBeGreaterThanOrEqual(2)

  await publicPage.goto(`/projects/${project.slug}`)
  // Wait for the controlled price to update, so SSR controls are not used before hydration.
  await expect(async () => {
    await publicPage.getByLabel('Unit Type', { exact: true }).selectOption(project.unitTypes[1].id)
    await expect(publicPage.getByText('PKR 12,000,000', { exact: true }).first()).toBeVisible({
      timeout: 2000,
    })
  }).toPass({ timeout: 15000 })
  const monthly = publicPage.getByLabel('Monthly amount', { exact: true })
  const displayed = await monthly.inputValue()
  await publicPage.getByLabel('Monthly amount method').selectOption('entered')
  await expect(monthly).toHaveValue(displayed)
  await expect(monthly).toBeEditable()
  await publicPage.getByLabel('Calculate my down payment from the installment amounts.').check()
  await expect(
    publicPage.getByText('Enter what you want to pay per period', { exact: false }),
  ).toBeVisible()
  await monthly.fill('170000')
  await expect(publicPage.getByRole('button', { name: 'Download PDF Plan' })).toBeEnabled()
  await publicPage.getByRole('button', { name: 'Download PDF Plan' }).click()
  await expect(publicPage.getByRole('dialog')).toBeVisible()
  await publicPage.getByPlaceholder("As you'd like the plan addressed").fill('E2E Buyer')
  await publicPage.getByRole('dialog').getByPlaceholder('3XX XXXXXXX').fill('+923001234567')
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
