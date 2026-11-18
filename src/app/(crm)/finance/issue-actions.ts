'use server'

import { revalidatePath } from 'next/cache'
import { financeSession } from '@/lib/finance-server'
import { currentFinanceIssues } from '@/lib/finance-issues'

export async function resolveFinanceIssue(_previous: { error: string }, form: FormData) {
  const { payload, user } = await financeSession()
  const note = String(form.get('note') || '').trim()
  if (!note || note.length > 2000) return { error: 'Enter a resolution note of up to 2,000 characters.' }
  const issue = (await currentFinanceIssues()).find((x) => x.fingerprint === form.get('fingerprint'))
  if (!issue) return { error: 'This issue has changed or cleared. Refresh the page to see its current status.' }
  try {
    await payload.create({
      collection: 'finance-issue-resolutions',
      data: { fingerprint: issue.fingerprint, title: issue.title, detail: issue.detail, href: issue.href, note, resolvedBy: `${user.id}: ${user.email}` },
    })
  } catch {
    return { error: 'Could not save the resolution. Please try again.' }
  }
  revalidatePath('/finance')
  return { error: '' }
}

export async function reopenFinanceIssue(_previous: { error: string }, form: FormData) {
  const { payload } = await financeSession()
  const fingerprint = String(form.get('fingerprint') || '')
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) return { error: 'Invalid issue.' }
  try {
    await payload.update({ collection: 'finance-issue-resolutions', where: { and: [
      { fingerprint: { equals: fingerprint } }, { reopenedAt: { exists: false } },
    ] }, data: { reopenedAt: new Date().toISOString() } })
  } catch {
    return { error: 'Could not reopen the issue. Please try again.' }
  }
  revalidatePath('/finance')
  return { error: '' }
}
