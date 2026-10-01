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
