import { expect, type Browser, type Page } from '@playwright/test'
import { baseURL } from './env'

/**
 * Lead deletion from the CRM record. Runs after verifyPaymentPlans, whose saved
 * revision supplies a valid plan for a fresh schedule.
 */
export async function verifyLeadDelete(page: Page, browser: Browser) {
  const origin = new URL(baseURL).origin
  const createLead = async (name: string) => {
    const response = await page.request.post('/api/leads', {
      data: { name, phone: '03001234567', sourceKind: 'listing' },
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).doc as { id: number; name: string; phone: string }
  }
  const gone = async (id: number) =>
    expect((await page.request.get(`/api/leads/${id}?depth=0`)).status()).toBe(404)

  // No linked records: one plain confirmation, Cancel keeps the lead.
  const plain = await createLead('Delete Plain E2E')
  await page.goto(`/leads-dashboard/${plain.id}`)
  await page.getByRole('button', { name: 'Delete lead', exact: true }).click()
  await expect(page.getByText('Delete this lead permanently?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Delete this lead permanently?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete lead', exact: true }).click()
  await page.getByRole('button', { name: 'Delete lead', exact: true }).click()
  await page.waitForURL(/\/leads-dashboard$/)
  await gone(plain.id)

  // Saved schedule and finance deal: two separate prompts; the deal survives.
  const linked = await createLead('Delete Linked E2E')
  const revision = (await (await page.request.get('/api/schedule-revisions?limit=1&depth=0')).json())
    .docs[0]
  const saved = await page.request.post(`/api/crm/leads/${linked.id}/schedules`, {
    headers: { origin },
    data: {
      plan: revision.settings,
      buyer: { name: linked.name, phone: linked.phone },
      title: 'Delete test schedule',
      note: '',
      entryKey: crypto.randomUUID(),
      expectedRevision: 0,
    },
  })
  expect(saved.ok(), await saved.text()).toBeTruthy()
  const scheduleId = (await saved.json()).id
  const dealResponse = await page.request.post('/api/finance-deals', {
    data: {
      lead: linked.id,
      clientName: 'Delete Linked E2E',
      project: revision.settings.projectId,
      unitNumber: 'D-1',
      dateClosed: '2026-10-01T00:00:00+05:00',
      saleValue: 12000000,
      fixedCommission: 240000,
      expectedPaymentDate: '2026-11-01T00:00:00+05:00',
    },
  })
  expect(dealResponse.ok(), await dealResponse.text()).toBeTruthy()
  const deal = (await dealResponse.json()).doc

  // /admin and the REST API refuse and point to the CRM.
  const adminDelete = await page.request.delete(`/api/leads/${linked.id}`)
  expect(adminDelete.ok()).toBeFalsy()
  expect(await adminDelete.text()).toContain('delete it from the CRM')

  // A user without finance access is blocked without seeing the deal.
  const staffEmail = 'lead-delete-staff@example.com'
  expect(
    (
      await page.request.post('/api/users', {
        data: {
          email: staffEmail,
          password: 'LeadDelete123!',
          name: 'No finance staff',
          financeAccess: false,
          financeAdmin: false,
        },
      })
    ).ok(),
  ).toBeTruthy()
  const staffContext = await browser.newContext()
  const staff = await staffContext.newPage()
  expect(
    (
      await staff.request.post('/api/users/login', {
        data: { email: staffEmail, password: 'LeadDelete123!' },
      })
    ).ok(),
  ).toBeTruthy()
  await staff.goto(`/leads-dashboard/${linked.id}`)
  await staff.getByRole('button', { name: 'Delete lead', exact: true }).click()
  await expect(
    staff.getByText('This lead is linked to a finance record – ask a finance admin.'),
  ).toBeVisible()
  await expect(staff.getByText('Delete Linked E2E, sale value')).toHaveCount(0)
  const forced = await staff.request.delete(`/api/crm/leads/${linked.id}`, {
    headers: { origin },
    data: { schedules: 1, keepFinanceDeals: true },
  })
  expect(forced.status()).toBe(403)
  await staffContext.close()

  // Finance user: schedules prompt, then the separate finance prompt.
  await page.goto(`/leads-dashboard/${linked.id}`)
  await page.getByRole('button', { name: 'Delete lead', exact: true }).click()
  await expect(
    page.getByText(
      'This lead has 1 saved payment schedule. Deleting the lead also deletes it permanently.',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Delete lead and schedules' }).click()
  await expect(page.getByText('This lead is linked to a finance deal')).toBeVisible()
  await expect(page.getByText('Delete Linked E2E, sale value Rs. 12,000,000')).toBeVisible()
  await page.getByRole('button', { name: 'Keep the deal and delete the lead' }).click()
  await page.waitForURL(/\/leads-dashboard$/)
  await gone(linked.id)
  expect((await page.request.get(`/api/lead-schedules/${scheduleId}`)).status()).toBe(404)
  const revisions = await (
    await page.request.get(`/api/schedule-revisions?where[schedule][equals]=${scheduleId}`)
  ).json()
  expect(revisions.totalDocs).toBe(0)
  const keptDeal = await (await page.request.get(`/api/finance-deals/${deal.id}?depth=0`)).json()
  expect(keptDeal.clientName).toBe('Delete Linked E2E')
  expect(keptDeal.lead ?? null).toBeNull()
}
