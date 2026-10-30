import { expect, type Browser, type Page } from '@playwright/test'
export async function verifyMobileCrm(page: Page) {
  const media = await (await page.request.get('/api/media?limit=1')).json()
  const projectRes = await page.request.post('/api/featured-projects', {
    data: {
      title: 'Mobile CRM Test',
      slug: 'mobile-crm-test',
      builderName: 'Test Builder',
      propertyType: 'Flat',
      location: 'Scheme 33',
      status: 'Pre-launch',
      elevationImages: [{ image: media.docs[0].id }],
    },
  })
  expect(projectRes.ok(), await projectRes.text()).toBeTruthy()
  const project = (await projectRes.json()).doc
  const oldViewport = page.viewportSize()
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/leads-dashboard/new')
  await page.getByLabel('Name', { exact: true }).fill('Mobile CRM Buyer')
  await page.getByLabel('Phone', { exact: true }).fill('03001234567')
  await page.getByLabel('Project interested in', { exact: true }).selectOption(String(project.id))
  await page.getByLabel('Source', { exact: true }).selectOption('referral')
  await page.getByRole('button', { name: 'Add lead', exact: true }).click()
  await expect(page).toHaveURL(/\/leads-dashboard\/\d+$/)
  const id = Number(page.url().split('/').pop())
  await expect(page.getByRole('heading', { name: 'Mobile CRM Buyer' })).toBeVisible()
  let lead = await (await page.request.get('/api/leads/' + id + '?depth=0')).json()
  expect(lead.acquiredProject).toBe(project.id)
  expect(lead.sourceSlug).toBe('mobile-crm-test')
  expect(lead.conversionSurface).toBe('crm-manual')
  expect(lead.acquisitionSource).toBe('referral')
  expect(lead.brochureId).toBeTruthy()

  // Only page opens in the rolling seven-day window count, including legacy
  // events without a lead relationship. More than the default API page size
  // ensures the viewer list does not silently truncate activity.
  const openIds: number[] = []
  for (let index = 0; index < 12; index++) {
    const response = await page.request.post('/api/link-opens', {
      data: {
        brochureId: lead.brochureId,
        ...(index ? { lead: id } : {}),
        asset: 'page',
        dwellMs: index === 0 ? null : 10000,
        createdAt: new Date(Date.now() - (index + 1) * 60000).toISOString(),
      },
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    openIds.push((await response.json()).doc.id)
  }
  for (const data of [
    { asset: 'page', createdAt: new Date(Date.now() - 8 * 86400_000).toISOString() },
    { asset: 'pdf1', createdAt: new Date().toISOString() },
  ]) {
    const response = await page.request.post('/api/link-opens', {
      data: { ...data, lead: id, brochureId: lead.brochureId, dwellMs: 900000 },
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    openIds.push((await response.json()).doc.id)
  }
  await page
    .getByRole('navigation', { name: 'CRM navigation' })
    .getByRole('link', { name: 'Brochures', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Brochure viewers', exact: true })).toBeVisible()
  const viewer = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Mobile CRM Buyer', exact: true }) })
  await expect(viewer.getByText('Repeat viewer', { exact: true })).toBeVisible()
  await expect(
    viewer.getByText('12 opens · 1m and 50s recorded reading time', { exact: true }),
  ).toBeVisible()
  await expect(viewer.getByText('Duration available for 11 of 12 visits.')).toBeVisible()
  await viewer.getByText('Visit durations', { exact: true }).click()
  await expect(viewer.getByRole('listitem')).toHaveCount(12)
  await expect(viewer.getByText('Duration not captured', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await viewer.getByRole('link').click()
  await expect(page).toHaveURL(new RegExp('/leads-dashboard/' + id + '$'))
  for (const openId of openIds) await page.request.delete('/api/link-opens/' + openId)

  await expect(page.getByText(/Referral.*CRM: manually added/)).toBeVisible()
  await page.request.patch('/api/leads/' + id, {
    data: {
      acquisitionSource: 'meta-ads',
      source: 'marketed-project-landing:hero',
      conversionSurface: 'marketed-hero-form',
      firstTouchCampaign: 'E2E Campaign',
      firstTouchTerm: 'E2E Ad Set',
      firstTouchContent: 'E2E Ad',
    },
  })
  await page.evaluate(() => sessionStorage.setItem('test-android-brochure', 'true'))
  await page.addInitScript(() => {
    if (sessionStorage.getItem('test-android-brochure')) {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile',
      })
    }
  })
  await page.reload()
  const brochure = page.getByRole('link', { name: 'Prepare brochure in WhatsApp' })
  await expect(brochure).toHaveAttribute(
    'href',
    /^intent:\/\/send\?phone=923001234567&text=.*package=com.whatsapp.w4b;/,
  )
  const appLink = await brochure.getAttribute('href')
  expect(decodeURIComponent(appLink!)).toContain('Mobile CRM Test')
  expect(decodeURIComponent(appLink!)).toContain('/brochure/' + lead.brochureId)
  // The test machine has no WhatsApp: stop navigation but exercise logging.
  await brochure.evaluate((el) => el.addEventListener('click', (event) => event.preventDefault()))
  await brochure.click()
  await expect
    .poll(async () => (await (await page.request.get('/api/leads/' + id)).json()).status)
    .toBe('details-sent')
  // Reports group by project, then source; Meta breaks down to campaign › ad set › ad.
  await page.goto('/leads-dashboard/reports')
  await page.locator('select[name="project"]').selectOption({ label: 'Mobile CRM Test' })
  await page.locator('select[name="channel"]').selectOption({ label: 'Meta paid ads' })
  await page.locator('select[name="period"]').selectOption('custom')
  await page.locator('input[name="from"]').fill('2020-01-01T00:00')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page).toHaveURL(/project=p%3A\d+.*channel=meta|channel=meta.*project=p%3A\d+/)
  const bySource = page.locator('section').filter({ hasText: 'By source' })
  for (const level of ['Meta paid ads', 'E2E Campaign', 'E2E Ad Set', 'E2E Ad'])
    await expect(bySource.getByRole('cell', { name: new RegExp(`^›? ?${level}$`) })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mobile CRM Buyer' })).toBeVisible()
  // Which form converted is backend detail and stays off the report.
  await expect(page.getByText(/Marketing page: top/)).toHaveCount(0)
  const csvResponse = await page.request.get(
    (await page.getByRole('link', { name: /Download CSV/ }).getAttribute('href')) || '',
  )
  const csv = await csvResponse.text()
  expect(csv).toContain('Mobile CRM Buyer')
  expect(csv).toContain('E2E Campaign,E2E Ad Set,E2E Ad')
  expect(csv).toContain('Marketing page: top (hero) form')
  const pdfResponse = await page.request.get(
    (await page.getByRole('link', { name: /Download PDF/ }).getAttribute('href')) || '',
  )
  expect(pdfResponse.status()).toBe(200)
  expect(pdfResponse.headers()['content-type']).toBe('application/pdf')
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe('%PDF-')
  for (const period of ['today', '7d', 'week', 'month', 'last-month']) {
    await page.goto(`/leads-dashboard/reports?period=${period}`)
    await expect(page.getByRole('heading', { name: 'Leads report' })).toBeVisible()
  }
  await page.evaluate(() => sessionStorage.removeItem('test-android-brochure'))
  await page.goto('/leads-dashboard/' + id)
  await expect(page.getByText(/Paid.*Meta ads.*Marketing page: top/)).toBeVisible()
  await page.getByLabel('Lead status', { exact: true }).selectOption('closed-won')
  await expect(page.getByText('Changes saved.')).toBeVisible()
  await page.getByRole('link', { name: 'Edit details', exact: true }).click()
  await page.getByLabel('Phone', { exact: true }).fill('03007654321')
  await page.getByLabel('Closed on project', { exact: true }).selectOption(String(project.id))
  await page.getByRole('button', { name: 'Save lead details', exact: true }).click()
  await expect
    .poll(
      async () => (await (await page.request.get('/api/leads/' + id + '?depth=0')).json()).phone,
    )
    .toBe('+923007654321')
  lead = await (await page.request.get('/api/leads/' + id + '?depth=0')).json()
  expect(lead.closedProject).toBe(project.id)
  expect(lead.acquiredProject).toBe(project.id)
  await page.goto('/leads-dashboard?q=Mobile+CRM+Buyer')
  await expect(page.getByRole('heading', { name: 'Mobile CRM Buyer' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  const manifest = await (await page.request.get('/leads-dashboard/manifest.webmanifest')).json()
  expect(manifest.start_url).toBe('/leads-dashboard')
  expect(manifest.display).toBe('standalone')
  expect(
    (await page.request.get('/leads-dashboard/sw.js')).headers()['service-worker-allowed'],
  ).toBe('/leads-dashboard')
  await page.request.delete('/api/leads/' + id)
  await page.request.delete('/api/featured-projects/' + project.id)
  if (oldViewport) await page.setViewportSize(oldViewport)
}

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

// Each account may be signed in on 2 phones/tablets; laptops never count. Uses its
// own user and signs every session out, so other specs keep logging in freely.
export async function verifyDeviceLimit(browser: Browser, admin: Page) {
  const email = 'device-limit@example.com',
    password = 'DeviceLimit123!'
  const created = await admin.request.post('/api/users', {
    data: { email, password, name: 'Device limit check' },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const user = (await created.json()).doc
  const signIn = async (phone: boolean) => {
    const context = await browser.newContext(
      phone ? { userAgent: iphone, viewport: { width: 390, height: 844 } } : {},
    )
    const page = await context.newPage()
    await page.goto('/leads-dashboard/login')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    return { context, page }
  }
  const phones = [await signIn(true), await signIn(true)]
  for (const { page } of phones) await expect(page).toHaveURL(/\/leads-dashboard$/)
  const third = await signIn(true)
  await expect(
    third.page.getByText(/already signed in on 2 phones\/tablets.*Signed-in devices/),
  ).toBeVisible()
  await expect(third.page).toHaveURL(/\/login/)

  const laptop = await signIn(false)
  await expect(laptop.page).toHaveURL(/\/leads-dashboard$/)
  await laptop.page.goto('/leads-dashboard/devices')
  const rows = laptop.page.getByRole('article')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('iPhone')
  await expect(rows.first()).toContainText('PKT')
  await rows.first().getByRole('button', { name: /^Sign out / }).click()
  await expect(rows).toHaveCount(1)
  // The signed-out phone lost its session.
  await phones[0].page.goto('/leads-dashboard')
  await expect(phones[0].page).toHaveURL(/\/login/)

  await third.page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(third.page).toHaveURL(/\/leads-dashboard$/)
  for (const { page } of [phones[1], third]) {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
  }
  await laptop.page.reload()
  await expect(rows).toHaveCount(0)
  for (const { context } of [...phones, third, laptop]) await context.close()
  await admin.request.delete('/api/users/' + user.id)
}
