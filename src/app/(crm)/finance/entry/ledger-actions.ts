'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type PayloadRequest } from 'payload'
import { financeSession } from '@/lib/finance-server'
import { dealPosition } from '@/lib/finance-ledger'
import { ledgerSum } from '@/lib/finance-tx'

// Posting for project funding, advertising charges and commission distribution. Every
// submission runs in one Payload transaction (attachments included), carries a single-use
// entry key against double submission, and leaves validation to the collection hooks.

const MAX_FILE = 10 * 1024 * 1024
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
const VOIDABLE = {
  funding: 'finance-funding',
  'ad-charges': 'finance-ad-charges',
  payouts: 'finance-payouts',
  transfers: 'finance-transfers',
  receipts: 'finance-receipts',
  expenses: 'finance-expenses',
} as const

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const num = (form: FormData, key: string) => (str(form, key) === '' ? undefined : Number(str(form, key)))
const id = (form: FormData, key: string) => {
  const n = Number(str(form, key))
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
const pktDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00+05:00` : undefined)
const pktDateTime = (v: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+05:00` : pktDate(v)
const json = (form: FormData, key: string): Record<string, unknown>[] => {
  try {
    const v = JSON.parse(str(form, key) || '[]')
    return Array.isArray(v) ? v.filter((r) => r && typeof r === 'object') : []
  } catch {
    throw new Error('The table could not be read. Reload the page and try again.')
  }
}
const split = (form: FormData, key: string) =>
  json(form, key)
    .filter((r) => r.participant || String(r.recipientName || '').trim() || String(r.percent ?? '') !== '')
    .map((r) => ({
      key: r.key ? String(r.key) : undefined,
      participant: Number(r.participant) || null,
      recipientName: String(r.recipientName || '').trim() || undefined,
      percent: Number(r.percent),
      role: String(r.role || '').trim() || undefined,
    }))

async function uploadFiles(form: FormData, req: PayloadRequest) {
  const ids: number[] = []
  for (const file of form.getAll('files')) {
    if (!(file instanceof File) || !file.size) continue
    if (file.size > MAX_FILE) throw new Error(`${file.name} is larger than 10 MB.`)
    if (!FILE_TYPES.includes(file.type)) throw new Error(`${file.name}: attach a PDF or an image.`)
    const doc = await req.payload.create({
      collection: 'finance-files',
      data: { description: file.name.slice(0, 200) },
      file: { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type, name: file.name, size: file.size },
      req,
      overrideAccess: false,
    })
    ids.push(doc.id)
  }
  return ids
}

export async function saveLedgerEntry(_previous: { error: string }, form: FormData): Promise<{ error: string }> {
  const { payload, user } = await financeSession()
  const kind = str(form, 'kind')
  const entryKey = str(form, 'entryKey')
  if (!/^[a-f\d-]{36}$/i.test(entryKey)) return { error: 'Invalid submission. Reload the form.' }
  const req = await createLocalReq({ user }, payload)
  await initTransaction(req)
  const opts = { req, overrideAccess: false } as const
  let destination = '/finance'
  // Create once per entry key: a retried or double-clicked submission returns the first.
  const createOnce = async (collection: Parameters<typeof payload.create>[0]['collection'], data: Record<string, unknown>) => {
    const existing = await payload.find({ collection, where: { entryKey: { equals: entryKey } }, limit: 1, depth: 0, ...opts })
    if (existing.docs[0]) return existing.docs[0] as { id: number }
    return (await payload.create({ collection, data: { ...data, entryKey } as never, ...opts })) as { id: number }
  }
  try {
    switch (kind) {
      case 'participant': {
        const pid = id(form, 'id')
        const data = { name: str(form, 'name'), phone: str(form, 'phone') || null, isOwner: str(form, 'isOwner') === 'true', notes: str(form, 'notes') || null }
        if (pid) await payload.update({ collection: 'finance-participants', id: pid, data, ...opts })
        else await createOnce('finance-participants', data)
        destination = '/finance/participants'
        break
      }
      case 'archive': {
        const collection = str(form, 'collection') === 'accounts' ? 'finance-accounts' : 'finance-participants'
        await payload.update({ collection, id: id(form, 'id') || 0, data: { archived: str(form, 'archived') === 'true' }, ...opts })
        destination = collection === 'finance-accounts' ? '/finance/accounts' : '/finance/participants'
        break
      }
      case 'account': {
        const opening = (['owner', 'commission', 'other'] as const)
          .map((purpose) => ({ purpose, amount: num(form, `opening_${purpose}`), note: str(form, `opening_${purpose}_note`) || undefined }))
          .filter((o) => o.amount)
        const aid = id(form, 'id')
        const data = {
          name: str(form, 'name'),
          kind: str(form, 'accountKind') || 'bank',
          cardLabel: str(form, 'cardLabel') || null,
          openingBalance: num(form, 'openingBalance') ?? 0,
          openingDate: pktDate(str(form, 'openingDate')),
          openingClassification: opening,
          notes: str(form, 'notes') || null,
          changeReason: str(form, 'changeReason') || undefined,
        }
        if (aid) await payload.update({ collection: 'finance-accounts', id: aid, data: data as never, ...opts })
        else await createOnce('finance-accounts', data)
        destination = '/finance/accounts'
        break
      }
      case 'rules':
      case 'preset-add':
      case 'preset-remove': {
        const project = id(form, 'project')
        if (!project) throw new Error('Choose a project.')
        const found = await payload.find({ collection: 'finance-project-rules', where: { project: { equals: project } }, limit: 1, depth: 0, ...opts })
        const current = found.docs[0]
        const data: Record<string, unknown> = { changeReason: str(form, 'changeReason') || undefined }
        if (kind === 'rules') {
          data.funding = split(form, 'funding').map((r) => ({ participant: r.participant, percent: r.percent }))
          data.commission = split(form, 'commission')
          data.plannedDailyBudget = num(form, 'plannedDailyBudget') ?? 5000
        } else if (kind === 'preset-add') {
          data.presets = [
            ...(current?.presets || []),
            { name: str(form, 'presetName'), kind: str(form, 'presetKind') || 'custom', lines: split(form, 'lines') },
          ]
        } else data.presets = (current?.presets || []).filter((p) => p.id !== str(form, 'presetId'))
        if (current) await payload.update({ collection: 'finance-project-rules', id: current.id, data: data as never, ...opts })
        else await createOnce('finance-project-rules', { ...data, project, changeReason: undefined })
        destination = `/finance/projects/${project}`
        break
      }
      case 'campaign': {
        const cid = id(form, 'id')
        const data = {
          project: id(form, 'project'),
          name: str(form, 'name'),
          metaCampaignId: str(form, 'metaCampaignId') || null,
          startAt: pktDateTime(str(form, 'startAt')),
          endAt: pktDateTime(str(form, 'endAt')) || null,
          dailyBudget: num(form, 'dailyBudget'),
          fundingTarget: num(form, 'fundingTarget') ?? null,
          status: str(form, 'status') || 'active',
          notes: str(form, 'notes') || null,
        }
        if (cid) {
          const { project: _project, ...rest } = data
          await payload.update({ collection: 'finance-campaigns', id: cid, data: rest as never, ...opts })
        } else await createOnce('finance-campaigns', data)
        destination = `/finance/projects/${data.project}`
        break
      }
      case 'funding': {
        const attachments = await uploadFiles(form, req)
        const data = {
          kind: str(form, 'fundingKind'),
          direction: str(form, 'direction') || 'increase',
          participant: id(form, 'participant'),
          project: id(form, 'project'),
          campaign: id(form, 'campaign'),
          pledge: id(form, 'pledge'),
          amount: num(form, 'amount'),
          date: pktDate(str(form, 'date')),
          account: id(form, 'account'),
          paymentMethod: str(form, 'paymentMethod') || null,
          reference: str(form, 'reference') || null,
          notes: str(form, 'notes') || null,
          attachments,
        }
        await createOnce('finance-funding', data)
        destination = `/finance/projects/${data.project}`
        break
      }
      case 'ad-charge': {
        const attachments = await uploadFiles(form, req)
        const lines = json(form, 'lines').map((l) => ({
          campaign: Number(l.campaign) || null,
          metaAmount: Number(l.metaAmount),
          metaReceipt: String(l.metaReceipt || '').trim() || undefined,
        }))
        await createOnce('finance-ad-charges', {
          date: pktDateTime(str(form, 'date')),
          account: id(form, 'account'),
          cardLabel: str(form, 'cardLabel') || null,
          bankDebit: num(form, 'bankDebit'),
          metaReference: str(form, 'metaReference') || null,
          chargeBreakdown: str(form, 'chargeBreakdown') || null,
          notes: str(form, 'notes') || null,
          lines,
          attachments,
        })
        destination = '/finance/ad-charges'
        break
      }
      case 'payout': {
        const proof = await uploadFiles(form, req)
        const deal = id(form, 'deal')
        await createOnce('finance-payouts', {
          deal,
          recipientKey: str(form, 'recipientKey'),
          amount: num(form, 'amount'),
          date: pktDate(str(form, 'date')),
          account: id(form, 'account'),
          paymentMethod: str(form, 'paymentMethod') || null,
          reference: str(form, 'reference') || null,
          notes: str(form, 'notes') || null,
          proof,
        })
        destination = `/finance/deals/${deal}`
        break
      }
      case 'transfer': {
        const attachments = await uploadFiles(form, req)
        await createOnce('finance-transfers', {
          date: pktDate(str(form, 'date')),
          fromAccount: id(form, 'fromAccount'),
          toAccount: id(form, 'toAccount'),
          amount: num(form, 'amount'),
          kind: str(form, 'transferKind') || 'transfer',
          reference: str(form, 'reference') || null,
          notes: str(form, 'notes') || null,
          attachments,
        })
        destination = '/finance/accounts'
        break
      }
      case 'statement': {
        const attachments = await uploadFiles(form, req)
        await createOnce('finance-statements', {
          account: id(form, 'account'),
          date: pktDate(str(form, 'date')),
          statementBalance: num(form, 'statementBalance'),
          notes: str(form, 'notes') || null,
          attachments,
        })
        destination = '/finance/accounts'
        break
      }
      case 'deal-split': {
        const deal = id(form, 'deal') || 0
        await payload.update({
          collection: 'finance-deals',
          id: deal,
          data: {
            commissionMode: (str(form, 'commissionMode') || 'custom') as 'custom',
            referrerName: str(form, 'referrerName') || null,
            campaign: id(form, 'campaign'),
            commissionSplit: split(form, 'commissionSplit'),
            changeReason: str(form, 'changeReason') || undefined,
          },
          ...opts,
        })
        destination = `/finance/deals/${deal}`
        break
      }
      case 'deal-expense': {
        const attachments = await uploadFiles(form, req)
        const deal = id(form, 'deal')
        const designation = str(form, 'preDistribution')
        if (!['true', 'false'].includes(designation))
          throw new Error('Say whether this expense is deducted before commission distribution.')
        const paid = str(form, 'paymentStatus') !== 'unpaid'
        if (paid && !id(form, 'account')) throw new Error('Choose the account it was paid from.')
        await createOnce('finance-expenses', {
          deal,
          date: pktDate(str(form, 'date')),
          amount: num(form, 'amount'),
          category: str(form, 'category') || 'Deal expense',
          description: str(form, 'description'),
          vendor: str(form, 'vendor') || null,
          preDistribution: designation === 'true',
          paymentStatus: paid ? 'paid' : 'unpaid',
          account: paid ? id(form, 'account') : null,
          paymentMethod: str(form, 'paymentMethod') || null,
          reference: str(form, 'reference') || null,
          notes: str(form, 'notes') || null,
          attachments,
        })
        destination = `/finance/deals/${deal}`
        break
      }
      case 'expense-paid': {
        const expense = id(form, 'id') || 0
        if (!id(form, 'account')) throw new Error('Choose the account it was paid from.')
        const doc = await payload.update({
          collection: 'finance-expenses',
          id: expense,
          data: {
            paymentStatus: 'paid',
            paidDate: pktDate(str(form, 'paidDate')),
            account: id(form, 'account'),
            paymentMethod: str(form, 'paymentMethod') || null,
            reference: str(form, 'reference') || null,
          },
          ...opts,
        })
        const deal = typeof doc.deal === 'object' ? doc.deal?.id : doc.deal
        destination = deal ? `/finance/deals/${deal}` : '/finance/expenses'
        break
      }
      case 'void': {
        const collection = VOIDABLE[str(form, 'collection') as keyof typeof VOIDABLE]
        if (!collection) throw new Error('This entry cannot be voided here.')
        const reason = str(form, 'voidReason')
        if (!reason) throw new Error('Give a reason for voiding this entry.')
        await payload.update({ collection, id: id(form, 'id') || 0, data: { voided: true, voidReason: reason } as never, ...opts })
        const next = str(form, 'next')
        destination = /^\/finance(\/[\w/?=&-]*)?$/.test(next) ? next : '/finance'
        break
      }
      case 'split-mine': {
        // One tap for the common case: the whole commission is mine.
        const deal = id(form, 'deal') || 0
        const owner = await payload.find({ collection: 'finance-participants', where: { isOwner: { equals: true } }, limit: 1, depth: 0, ...opts })
        if (!owner.docs[0]) throw new Error('Add yourself as a person first (Money → People, tick "This is me").')
        await payload.update({
          collection: 'finance-deals',
          id: deal,
          data: {
            commissionMode: 'custom',
            commissionSplit: [{ participant: owner.docs[0].id, percent: 100 }],
            changeReason: str(form, 'changeReason') || 'All commission is mine',
          },
          ...opts,
        })
        destination = `/finance/deals/${deal}`
        break
      }
      case 'commission': {
        // Commission received, optionally paid out at the same time (e.g. withdrawn to me).
        const deal = id(form, 'deal') || 0
        const account = id(form, 'account')
        const payOut = str(form, 'afterwards') === 'paid'
        if (payOut && !account) throw new Error('Choose the account it went into before it was paid out.')
        const who = str(form, 'split')
        if (who === 'mine' || who === 'default') {
          const dealDoc = await payload.findByID({ collection: 'finance-deals', id: deal, depth: 0, ...opts })
          if (!dealDoc.commissionSplit?.length) {
            let split: { participant: number | null; recipientName?: string | null; percent: number; role?: string | null }[] = []
            if (who === 'default' && dealDoc.project) {
              const rules = await payload.find({ collection: 'finance-project-rules', where: { project: { equals: typeof dealDoc.project === 'object' ? dealDoc.project.id : dealDoc.project } }, limit: 1, depth: 0, ...opts })
              split = (rules.docs[0]?.commission || []).map((r) => ({
                participant: typeof r.participant === 'object' ? r.participant?.id ?? null : r.participant ?? null,
                recipientName: r.recipientName,
                percent: r.percent,
                role: r.role,
              }))
            }
            if (!split.length) {
              const owner = await payload.find({ collection: 'finance-participants', where: { isOwner: { equals: true } }, limit: 1, depth: 0, ...opts })
              if (!owner.docs[0]) throw new Error('Add yourself as a person first (Money → People, tick "This is me").')
              split = [{ participant: owner.docs[0].id, percent: 100 }]
            }
            await payload.update({
              collection: 'finance-deals',
              id: deal,
              data: { commissionMode: who === 'default' && split.length > 1 ? 'project-default' : 'custom', commissionSplit: split },
              ...opts,
            })
          }
        }
        const attachments = await uploadFiles(form, req)
        const existing = await payload.find({ collection: 'finance-receipts', where: { entryKey: { equals: entryKey } }, limit: 1, depth: 0, ...opts })
        if (!existing.docs[0]) {
          await payload.create({
            collection: 'finance-receipts',
            data: {
              deal,
              date: pktDate(str(form, 'date')) as string,
              amount: num(form, 'amount') as number,
              nextExpectedDate: pktDate(str(form, 'nextExpectedDate')) || null,
              account,
              paymentMethod: str(form, 'paymentMethod') || null,
              reference: str(form, 'reference') || null,
              notes: str(form, 'notes') || null,
              attachments,
              entryKey,
            },
            ...opts,
          })
          if (payOut) {
            // Read through the open transaction so the new receipt is included.
            const position = await dealPosition((q) => ledgerSum(req, q), deal)
            if (!position?.recipients.length)
              throw new Error('Say who shares this commission (for example "All mine") before paying it out.')
            for (const r of position.recipients.filter((x) => x.unpaidPaisa > 0))
              await payload.create({
                collection: 'finance-payouts',
                data: {
                  deal,
                  recipientKey: r.key,
                  amount: r.unpaidPaisa / 100,
                  date: pktDate(str(form, 'payoutDate') || str(form, 'date')) as string,
                  account: account as number,
                  paymentMethod: str(form, 'payoutMethod') || 'Withdrawal',
                  reference: str(form, 'payoutReference') || null,
                  notes: 'Paid out when the commission was recorded.',
                },
                ...opts,
              })
          }
        }
        destination = `/finance/deals/${deal}`
        break
      }
      case 'receipt-account': {
        // Put an older receipt into the account it was paid into (one time only).
        const receipt = id(form, 'id') || 0
        const doc = await payload.update({ collection: 'finance-receipts', id: receipt, data: { account: id(form, 'account') }, ...opts })
        destination = `/finance/deals/${typeof doc.deal === 'object' ? doc.deal.id : doc.deal}`
        break
      }
      default:
        throw new Error('Invalid entry type.')
    }
    await commitTransaction(req)
  } catch (error) {
    await killTransaction(req)
    return { error: error instanceof Error ? error.message : 'Could not save this entry. Please retry.' }
  }
  revalidatePath('/finance', 'layout')
  redirect(destination)
}
