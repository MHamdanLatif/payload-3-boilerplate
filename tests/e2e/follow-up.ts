import { expect, type Page } from '@playwright/test'

export async function verifyFollowUp(page: Page, id: number) {
  await page.goto(`/leads-dashboard/${id}`)
  await expect(page.getByLabel('Follow-up reminder', { exact: true })).toHaveValue('none')
  await page
    .getByLabel('Conversation notes', { exact: true })
    .fill('24 Sep: Prefers a corner unit. Discuss budget next call.\nSend updated pricing.')
  await page.getByRole('button', { name: 'Save notes & reminder' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  await page.reload()
  await expect(page.getByLabel('Conversation notes', { exact: true })).toHaveValue(
    /Prefers a corner unit/,
  )
  const future = new Date(Date.now() + 86400000 + 5 * 3600000).toISOString().slice(0, 16)
  await page.getByLabel('Follow-up reminder', { exact: true }).selectOption('scheduled')
  await page.getByLabel('Reminder date and time (PKT, UTC+5)', { exact: true }).fill(future)
  await page.getByRole('button', { name: 'Save notes & reminder' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  const saved = await (await page.request.get(`/api/leads/${id}`)).json()
  expect(saved.followUpAt).toBe(new Date(`${future}:00+05:00`).toISOString())
  expect(saved.followUpSentAt).toBeFalsy()
  expect(
    (
      await page.request.patch(`/api/leads/${id}`, { data: { followUpAt: '2000-01-01T00:00:00Z' } })
    ).ok(),
  ).toBeFalsy()
  expect(
    (
      await page.request.patch(`/api/leads/${id}`, {
        headers: { Cookie: '' },
        data: { conversationNotes: 'Unauthorized' },
      })
    ).status(),
  ).toBe(403)
  await page.reload()
  await expect(page.getByLabel('Follow-up reminder', { exact: true })).toHaveValue('scheduled')
  await page.getByLabel('Follow-up reminder', { exact: true }).selectOption('none')
  await page.getByRole('button', { name: 'Save notes & reminder' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  await page.reload()
  await expect(page.getByLabel('Follow-up reminder', { exact: true })).toHaveValue('none')
  expect((await (await page.request.get(`/api/leads/${id}`)).json()).followUpAt).toBeNull()
}
