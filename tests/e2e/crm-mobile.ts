import { expect, type Page } from '@playwright/test'
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
  await page.goto('/leads-dashboard/reports')
  const reportOption = page.getByRole('option', {
    name: /Mobile CRM Test.*Paid.*Meta ads.*Marketing page: top/,
  })
  const reportLabel = await reportOption.textContent()
  expect(reportLabel).toBeTruthy()
  await page.getByLabel('Source', { exact: true }).selectOption({ label: reportLabel! })
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  const csvResponse = await page.request.get(
    (await page.getByRole('link', { name: /Download CSV/ }).getAttribute('href')) || '',
  )
  const csv = await csvResponse.text()
  expect(csv).toContain('Mobile CRM Buyer')
  expect(csv).toContain('Marketing page: top (hero) form')
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
