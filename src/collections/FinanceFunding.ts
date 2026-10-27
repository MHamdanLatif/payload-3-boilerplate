import path from 'path'
import { fileURLToPath } from 'url'
import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type Field,
  type NumberField,
  type PayloadRequest,
} from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { financeAccess } from '@/access/finance'
import {
  allocateCharge,
  allocateToParticipants,
  checkSplit,
  fromPaisa,
  toPaisa,
} from '@/lib/finance-math'
import { financeAudit, ledgerSum, lockFinance } from '@/lib/finance-tx'
import { dealPosition, fundingSplit, projectPosition, projectRules, type Exec } from '@/lib/finance-ledger'
import { attachments, date, idOf, money, normaliseSplit, splitFields, text } from './Finance'

// Project funding, advertising charges and commission distribution. Posted money is
// immutable: mistakes are voided with a reason and re-entered, and every change is
// written to finance-audit-log. Records that carry cash cannot be deleted.

const dirname = path.dirname(fileURLToPath(import.meta.url))
const signedMoney = (name: string): NumberField => ({
  name,
  type: 'number',
  defaultValue: 0,
  validate: (v) =>
    v == null ||
    (Number.isFinite(v) && Math.abs(v) <= 999999999999 && Math.abs(v * 100 - Math.round(v * 100)) < 0.001) ||
    'Use an amount with at most two decimal places.',
})
const rel = (name: string, relationTo: string, required = false): Field =>
  ({ name, type: 'relationship', relationTo, required, index: true }) as Field
const dateTime = (name: string, required = true): Field => ({
  name,
  type: 'date',
  required,
  index: true,
  admin: { date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd MMM yyyy HH:mm' } },
})
const choice = (name: string, options: [string, string][], defaultValue?: string): Field => ({
  name,
  type: 'select',
  required: Boolean(defaultValue),
  defaultValue,
  options: options.map(([value, label]) => ({ value, label })),
})
const exec =
  (req: PayloadRequest): Exec =>
  (query) =>
    ledgerSum(req, query)
const fail = (message: string): never => {
  throw new APIError(message, 400)
}
const norm = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(norm)
    : v && typeof v === 'object'
      ? 'createdAt' in (v as object)
        ? (v as { id: unknown }).id
        : Object.fromEntries(
            Object.entries(v as object)
              .filter(([k]) => k !== 'id')
              .map(([k, x]) => [k, norm(x)]),
          )
      : v == null || v === ''
        ? null
        : typeof v === 'number'
          ? v
          : String(v)

type Options = {
  title: string
  description: string
  voidable?: boolean
  /** Field names that cannot change once saved. */
  immutable?: string[]
  /** Field names whose change needs a written reason. */
  reasoned?: string[]
  /** Table and columns that make a record "in use" and so not deletable. */
  references?: string[]
  beforeChange?: CollectionBeforeChangeHook[]
  hidden?: boolean
}
function ledger(slug: string, fields: Field[], o: Options): CollectionConfig {
  const stamp: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
    data.createdBy = operation === 'create' ? req.user?.id : idOf(originalDoc?.createdBy)
    data.updatedBy = req.user?.id
    if (operation === 'create') data.entryKey ||= crypto.randomUUID()
    else data.entryKey = originalDoc?.entryKey
    if (operation === 'create' && data.voided) fail('A new entry cannot start voided.')
    if (operation !== 'update' || !originalDoc) return data
    if (data.voided && !String(data.voidReason || originalDoc.voidReason || '').trim())
      fail('A reason is required to void a record.')
    if (originalDoc.voided && data.voided === false)
      fail('Voided entries cannot be restored. Create a replacement.')
    for (const field of o.immutable || [])
      if (data[field] !== undefined && JSON.stringify(norm(data[field])) !== JSON.stringify(norm(originalDoc[field])))
        fail(`Posted ${field} cannot change. Void this entry and create a replacement.`)
    const changed = (o.reasoned || []).filter(
      (field) =>
        data[field] !== undefined && JSON.stringify(norm(data[field])) !== JSON.stringify(norm(originalDoc[field])),
    )
    if (
      changed.length &&
      (!String(data.changeReason || '').trim() || data.changeReason === originalDoc.changeReason)
    )
      fail(`Give a reason for changing ${changed.join(', ')}.`)
    return data
  }
  return {
    slug,
    access: {
      create: financeAccess,
      read: financeAccess,
      update: financeAccess,
      delete: o.references ? financeAccess : () => false,
    },
    admin: { group: 'Finance', useAsTitle: o.title, description: o.description, hidden: o.hidden },
    hooks: {
      beforeChange: [stamp, ...(o.beforeChange || [])],
      afterChange: [financeAudit],
      beforeDelete: [
        async ({ id, req }) => {
          for (const ref of o.references || []) {
            const [table, column] = ref.split('.')
            const [row] = await ledgerSum(
              req,
              sql`SELECT COUNT(*)::int AS n FROM ${sql.raw(table)} WHERE ${sql.raw(column)}=${id}`,
            )
            if (Number(row?.n))
              fail('This record is used by finance entries. Archive it instead of deleting it.')
          }
        },
      ],
    },
    fields: [
      ...fields,
      { name: 'notes', type: 'textarea' },
      ...(o.reasoned?.length
        ? [{ ...text('changeReason'), admin: { description: 'Why the last change was made.' } } as Field]
        : []),
      { name: 'entryKey', type: 'text', unique: true, index: true, admin: { hidden: true } },
      ...(o.voidable
        ? ([
            {
              name: 'voided',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Exclude from balances. A reason is required. Cannot be undone.' },
            },
            text('voidReason'),
          ] as Field[])
        : []),
      {
        ...(rel('createdBy', 'users') as object),
        admin: { readOnly: true },
        access: { create: () => false, update: () => false },
      } as Field,
      {
        ...(rel('updatedBy', 'users') as object),
        admin: { readOnly: true },
        access: { create: () => false, update: () => false },
      } as Field,
    ],
    timestamps: true,
  }
}

export const FinanceParticipants = ledger(
  'finance-participants',
  [
    text('name', true),
    text('phone'),
    {
      name: 'isOwner',
      type: 'checkbox',
      defaultValue: false,
      label: 'This is me (Lateef Properties owner)',
    },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Hide from new entries. History and balances are kept.' },
    },
  ],
  {
    title: 'name',
    description: 'People who fund projects or receive commission. Archive instead of deleting.',
    references: [
      'finance_funding.participant_id',
      'finance_ad_charges_shares.participant_id',
      'finance_project_rules_funding.participant_id',
      'finance_project_rules_commission.participant_id',
      'finance_deals_commission_split.participant_id',
      'finance_payouts.participant_id',
    ],
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        if (data.isOwner && !originalDoc?.isOwner) {
          const [row] = await ledgerSum(
            req,
            sql`SELECT COUNT(*)::int AS n FROM finance_participants WHERE is_owner AND id<>${originalDoc?.id || 0}`,
          )
          if (Number(row?.n)) fail('Another participant is already marked as you.')
        }
        return data
      },
    ],
  },
)

export const FinanceAccounts = ledger(
  'finance-accounts',
  [
    text('name', true),
    choice(
      'kind',
      [
        ['bank', 'Bank account'],
        ['cash', 'Cash'],
        ['card', 'Card that settles later'],
      ],
      'bank',
    ),
    {
      ...text('cardLabel'),
      admin: { description: 'A label such as "Visa ending 1234". Never store full card details.' },
      validate: (v: unknown) =>
        !v || !/\d{8,}/.test(String(v).replace(/[\s-]/g, '')) || 'Store only a label or last four digits.',
    } as Field,
    {
      ...signedMoney('openingBalance'),
      admin: { description: 'Recorded balance when you started using this account here. A card that is owed is negative.' },
    },
    {
      name: 'openingDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd MMM yyyy' } },
    },
    {
      name: 'openingClassification',
      type: 'array',
      admin: {
        description:
          'Part of the opening balance that is known to be yours, retained commission or something else. Project funding is classified with Opening funding entries. Anything left is shown as unclassified.',
      },
      fields: [
        choice(
          'purpose',
          [
            ['owner', 'My own money'],
            ['commission', 'Commission retained pending distribution'],
            ['other', 'Other (explain in note)'],
          ],
          'owner',
        ),
        { ...signedMoney('amount'), required: true },
        text('note'),
      ],
    },
    { name: 'archived', type: 'checkbox', defaultValue: false },
  ],
  {
    title: 'name',
    description: 'Bank, cash and card accounts. Balances here are recorded balances, not live bank balances.',
    reasoned: ['openingBalance', 'openingDate', 'openingClassification'],
    references: [
      'finance_funding.account_id',
      'finance_ad_charges.account_id',
      'finance_receipts.account_id',
      'finance_expenses.account_id',
      'finance_payouts.account_id',
      'finance_transfers.from_account_id',
      'finance_transfers.to_account_id',
      'finance_statements.account_id',
    ],
  },
)

const validateRules: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const merged = { ...originalDoc, ...data }
  const funding = (merged.funding || []) as { participant: unknown; percent: number }[]
  if (funding.length) {
    for (const f of funding) {
      const p = await req.payload.findByID({
        collection: 'finance-participants',
        id: idOf(f.participant) as number,
        depth: 0,
        req,
        overrideAccess: false,
      })
      if (p.archived && !originalDoc?.funding?.some((o: { participant: unknown }) => idOf(o.participant) === p.id))
        fail(`${p.name} is archived and cannot be added to a funding split.`)
      ;(f as { name?: string }).name = p.name
    }
    checkSplit(
      funding.map((f) => ({
        key: String(idOf(f.participant)),
        label: (f as { name?: string }).name || '',
        pct: f.percent,
      })),
      'Funding split',
    )
    for (const f of funding) delete (f as { name?: string }).name
  }
  if (data.commission?.length) await normaliseSplit(data.commission, req, 'Default commission split')
  for (const preset of data.presets || []) {
    if (!String(preset.name || '').trim()) fail('Each commission preset needs a name.')
    if (preset.kind === 'referral' && !preset.lines?.some((l: { role?: string }) => /refer/i.test(l.role || '')))
      fail(`Preset "${preset.name}": mark the referrer's line with the role "Referrer".`)
    await normaliseSplit(preset.lines || [], req, `Preset "${preset.name}"`)
  }
  return data
}

export const FinanceProjectRules = ledger(
  'finance-project-rules',
  [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'featured-projects',
      required: true,
      unique: true,
      index: true,
    },
    {
      ...money('plannedDailyBudget', false),
      defaultValue: 5000,
      admin: { description: 'Planning figure per day for the whole project across all its ads (not per creative).' },
    },
    {
      name: 'funding',
      type: 'array',
      admin: { description: 'Who funds this project\'s advertising, and their share. Must total 100%.' },
      fields: [
        { name: 'participant', type: 'relationship', relationTo: 'finance-participants', required: true, index: true },
        { name: 'percent', type: 'number', required: true, min: 0, max: 100 },
      ],
    },
    {
      name: 'commission',
      type: 'array',
      admin: { description: 'Default commission distribution for this project\'s deals. Independent of funding.' },
      fields: splitFields,
    },
    {
      name: 'presets',
      type: 'array',
      admin: { description: 'Optional named commission arrangements, e.g. a referral split.' },
      fields: [
        text('name', true),
        choice(
          'kind',
          [
            ['referral', 'Referral'],
            ['custom', 'Custom'],
          ],
          'custom',
        ),
        { name: 'lines', type: 'array', fields: splitFields },
      ],
    },
  ],
  {
    title: 'project',
    description:
      'Funding and commission rules per project. Changes apply to new entries only; posted charges and saved deal splits keep their own snapshot.',
    reasoned: ['funding', 'commission', 'presets', 'plannedDailyBudget'],
    immutable: ['project'],
    beforeChange: [validateRules],
  },
)

export const FinanceCampaigns = ledger(
  'finance-campaigns',
  [
    { name: 'project', type: 'relationship', relationTo: 'featured-projects', required: true, index: true },
    text('name', true),
    { ...text('metaCampaignId'), admin: { description: 'Optional Meta campaign ID.' } },
    dateTime('startAt'),
    dateTime('endAt', false),
    {
      ...money('dailyBudget'),
      admin: { description: 'Planned daily budget for the whole campaign. Planning only, not spending.' },
    },
    { ...money('fundingTarget', false), admin: { description: 'Optional planned funding target.' } },
    choice(
      'status',
      [
        ['active', 'Active'],
        ['completed', 'Completed'],
      ],
      'active',
    ),
  ],
  {
    title: 'name',
    description: 'Advertising campaigns under a project. Budgets here are plans; actual spend comes from charges.',
    immutable: ['project'],
    references: ['finance_funding.campaign_id', 'finance_ad_charges_lines.campaign_id', 'finance_deals.campaign_id'],
    beforeChange: [
      async ({ data, originalDoc }) => {
        const m = { ...originalDoc, ...data }
        if (m.endAt && m.startAt && new Date(m.endAt) < new Date(m.startAt))
          fail('The end date is before the start date.')
        return data
      },
    ],
  },
)

const checkFunding: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const kind = data.kind
  if (!['pledge', 'contribution', 'refund', 'adjustment', 'opening'].includes(kind)) fail('Choose the entry type.')
  if (!(Number(data.amount) > 0)) fail('Enter an amount greater than zero.')
  const participant = await req.payload.findByID({
    collection: 'finance-participants',
    id: idOf(data.participant) as number,
    depth: 0,
    req,
    overrideAccess: false,
  })
  if (participant.archived) fail(`${participant.name} is archived.`)
  if (data.campaign) {
    const campaign = await req.payload.findByID({
      collection: 'finance-campaigns',
      id: idOf(data.campaign) as number,
      depth: 0,
      req,
      overrideAccess: false,
    })
    if (String(idOf(campaign.project)) !== String(idOf(data.project)))
      fail('The campaign belongs to a different project.')
  }
  if (!['adjustment', 'opening'].includes(kind)) data.direction = 'increase'
  if (['pledge', 'adjustment'].includes(kind)) data.account = null
  else if (!data.account) fail('Choose the bank/cash account the money moved through.')
  if (kind === 'adjustment' && !String(data.notes || '').trim())
    fail('Document the reason for a funding adjustment in the notes.')
  if (kind !== 'contribution') data.pledge = null
  if (data.pledge) {
    const pledge = await req.payload.findByID({
      collection: 'finance-funding',
      id: idOf(data.pledge) as number,
      depth: 0,
      req,
      overrideAccess: false,
    })
    if (
      pledge.kind !== 'pledge' ||
      pledge.voided ||
      idOf(pledge.participant) !== participant.id ||
      String(idOf(pledge.project)) !== String(idOf(data.project))
    )
      fail('The promise must be an active pledge by the same person for the same project.')
  }
  if (kind === 'refund') {
    // A refund may only return this person's own unspent, cash-backed funding of this
    // project. It can never use another project's money, even in a shared bank account.
    await lockFinance(req, `project:${idOf(data.project)}`)
    const position = await projectPosition(exec(req), idOf(data.project) as number)
    const me = position.participants.find((p) => p.key === String(participant.id))
    const limit = me?.backedPaisa || 0
    if (toPaisa(data.amount) > limit)
      fail(
        `Refund is more than ${participant.name}'s cash-backed balance in this project (PKR ${fromPaisa(limit).toLocaleString('en-PK')}). The project pool cannot use other projects' money.`,
      )
  }
  return data
}

export const FinanceFunding = ledger(
  'finance-funding',
  [
    choice(
      'kind',
      [
        ['contribution', 'Contribution received'],
        ['pledge', 'Promised funding (no cash yet)'],
        ['refund', 'Funding refund'],
        ['adjustment', 'Funding adjustment (no cash)'],
        ['opening', 'Opening balance (migration)'],
      ],
      'contribution',
    ),
    choice(
      'direction',
      [
        ['increase', 'Increase balance'],
        ['decrease', 'Decrease balance'],
      ],
      'increase',
    ),
    rel('participant', 'finance-participants', true),
    rel('project', 'featured-projects', true),
    rel('campaign', 'finance-campaigns'),
    {
      ...(rel('pledge', 'finance-funding') as object),
      admin: { description: 'The promise this contribution fulfils, if any.' },
    } as Field,
    money('amount'),
    date('date'),
    {
      ...(rel('account', 'finance-accounts') as object),
      admin: { description: 'Receiving or paying account. Not used for promises or adjustments.' },
    } as Field,
    text('paymentMethod'),
    text('reference'),
    attachments(),
  ],
  {
    title: 'reference',
    description:
      'Project funding by participant. Only received contributions add cash. Promises, adjustments and openings are tracked separately. Funding is never commission income.',
    voidable: true,
    immutable: ['kind', 'direction', 'participant', 'project', 'campaign', 'pledge', 'amount', 'date', 'account'],
    beforeChange: [checkFunding],
  },
)

const postCharge: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const lines = (data.lines || []) as Record<string, any>[]
  if (!lines.length) fail('Add at least one campaign line.')
  const projects = new Map<number, Awaited<ReturnType<typeof projectRules>>>()
  for (const line of lines) {
    const campaign = await req.payload.findByID({
      collection: 'finance-campaigns',
      id: idOf(line.campaign) as number,
      depth: 0,
      req,
      overrideAccess: false,
    })
    line.project = idOf(campaign.project)
    line.campaignName = campaign.name
    line.campaignStart = campaign.startAt
    line.campaignEnd = campaign.endAt
    line.campaignStatus = campaign.status
    if (!projects.has(line.project)) projects.set(line.project, await projectRules(exec(req), line.project))
  }
  const allocation = allocateCharge(
    toPaisa(data.bankDebit),
    lines.map((l, i) => ({ key: String(i), metaPaisa: toPaisa(l.metaAmount) })),
  )
  const flags = [...allocation.flags]
  const shares: Record<string, unknown>[] = []
  lines.forEach((line, i) => {
    const rules = projects.get(line.project)
    const split = fundingSplit(rules)
    if (!split)
      fail(`Set the funding split for ${rules?.title || 'this project'} before recording its advertising charges.`)
    const a = allocation.lines[i]
    line.additionalCharges = fromPaisa(a.additionalPaisa)
    line.totalCost = fromPaisa(a.totalPaisa)
    for (const s of allocateToParticipants(a.totalPaisa, split!))
      shares.push({
        line: i,
        project: line.project,
        campaign: idOf(line.campaign),
        participant: Number(s.key),
        percent: s.units / 10000,
        amount: fromPaisa(s.paisa),
      })
    const when = new Date(data.date)
    if ((line.campaignStart && when < new Date(line.campaignStart)) || (line.campaignEnd && when > new Date(line.campaignEnd)))
      flags.push(`${line.campaignName}: the charge date is outside the campaign dates.`)
    if (line.campaignStatus === 'completed') flags.push(`${line.campaignName} is marked completed.`)
    for (const k of ['campaignName', 'campaignStart', 'campaignEnd', 'campaignStatus']) delete line[k]
  })
  if (data.metaReference?.trim()) {
    const [dup] = await ledgerSum(
      req,
      sql`SELECT COUNT(*)::int AS n FROM finance_ad_charges WHERE lower(meta_reference)=lower(${data.metaReference.trim()}) AND NOT COALESCE(voided,false)`,
    )
    if (Number(dup?.n)) flags.push(`Another charge already uses the reference ${data.metaReference.trim()}. Check it is not a duplicate.`)
  }
  data.metaTotal = fromPaisa(allocation.metaPaisa)
  data.additionalTotal = fromPaisa(allocation.additionalPaisa)
  data.shares = shares
  data.reviewFlags = flags.join('\n') || null
  return data
}

const computed = (field: Field): Field => ({
  ...field,
  admin: { ...(field as { admin?: object }).admin, readOnly: true },
}) as Field

export const FinanceAdCharges = ledger(
  'finance-ad-charges',
  [
    dateTime('date'),
    rel('account', 'finance-accounts', true),
    { ...text('cardLabel'), admin: { description: 'Card label only, e.g. "Visa 1234".' } },
    { ...money('bankDebit'), label: 'Actual bank debit (PKR)' },
    { ...text('metaReference'), admin: { description: 'Meta receipt or transaction reference.' } },
    {
      name: 'chargeBreakdown',
      type: 'textarea',
      label: 'Additional bank charges/taxes breakdown (if known)',
    },
    attachments(),
    {
      name: 'lines',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        rel('campaign', 'finance-campaigns', true),
        computed(rel('project', 'featured-projects')),
        { ...text('metaReceipt'), admin: { description: 'Meta receipt for this line, if different.' } },
        money('metaAmount'),
        computed({ name: 'additionalCharges', type: 'number' }),
        computed({ name: 'totalCost', type: 'number' }),
      ],
    },
    computed({ name: 'metaTotal', type: 'number' }),
    computed({ name: 'additionalTotal', type: 'number', label: 'Additional bank charges/taxes' }),
    computed({
      name: 'shares',
      type: 'array',
      admin: { description: 'Analytical split of each campaign\'s cost by the project\'s funding percentages at posting time.' },
      fields: [
        { name: 'line', type: 'number', admin: { description: 'Charge line (0-based) this share belongs to.' } },
        rel('project', 'featured-projects'),
        rel('campaign', 'finance-campaigns'),
        rel('participant', 'finance-participants'),
        { name: 'percent', type: 'number' },
        { name: 'amount', type: 'number' },
      ],
    } as Field),
    computed({ name: 'reviewFlags', type: 'textarea' }),
  ],
  {
    title: 'metaReference',
    description:
      'Meta charges and the actual bank debit. The debit reduces cash once; campaign and participant shares are breakdowns of it.',
    voidable: true,
    immutable: ['date', 'account', 'bankDebit', 'metaReference', 'lines', 'shares', 'metaTotal', 'additionalTotal'],
    beforeChange: [postCharge],
  },
)

const checkPayout: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (!(Number(data.amount) > 0)) fail('Enter a payout greater than zero.')
  if (!data.account) fail('Choose the account the payout was made from.')
  if (!String(data.paymentMethod || '').trim() || !String(data.reference || '').trim())
    fail('Enter the payment method and reference for the payout.')
  const deal = idOf(data.deal) as number
  await lockFinance(req, `deal:${deal}`)
  const position = await dealPosition(exec(req), deal)
  if (!position) fail('Deal not found.')
  const recipient = position!.recipients.find((r) => r.key === data.recipientKey)
  if (!recipient) fail('Choose a recipient from this deal\'s commission split.')
  if (toPaisa(data.amount) > recipient!.unpaidPaisa)
    fail(
      `This is more than ${recipient!.label}'s unpaid commission on this deal (PKR ${fromPaisa(recipient!.unpaidPaisa).toLocaleString('en-PK')}).`,
    )
  const line = position!.split.find((s) => s.key === data.recipientKey)
  data.recipientName = recipient!.label
  data.participant = line?.participant_id || null
  return data
}

export const FinancePayouts = ledger(
  'finance-payouts',
  [
    rel('deal', 'finance-deals', true),
    { ...text('recipientKey', true), admin: { readOnly: true } },
    computed(text('recipientName')),
    computed(rel('participant', 'finance-participants')),
    money('amount'),
    date('date'),
    rel('account', 'finance-accounts', true),
    text('paymentMethod'),
    text('reference'),
    attachments('proof'),
  ],
  {
    title: 'recipientName',
    description: 'Actual commission payouts. An entitlement is not a payout until it is recorded here.',
    voidable: true,
    immutable: ['deal', 'recipientKey', 'recipientName', 'participant', 'amount', 'date', 'account'],
    beforeChange: [checkPayout],
  },
)

export const FinanceTransfers = ledger(
  'finance-transfers',
  [
    date('date'),
    rel('fromAccount', 'finance-accounts', true),
    rel('toAccount', 'finance-accounts', true),
    money('amount'),
    choice(
      'kind',
      [
        ['transfer', 'Transfer between accounts'],
        ['card-settlement', 'Card settlement'],
      ],
      'transfer',
    ),
    text('reference'),
    attachments(),
  ],
  {
    title: 'reference',
    description: 'Money moved between your own accounts. Settling a card is a transfer, never a second expense.',
    voidable: true,
    immutable: ['date', 'fromAccount', 'toAccount', 'amount', 'kind'],
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        if (String(idOf(data.fromAccount)) === String(idOf(data.toAccount))) fail('Choose two different accounts.')
        if (!(Number(data.amount) > 0)) fail('Enter an amount greater than zero.')
        if (data.kind === 'card-settlement') {
          const to = await req.payload.findByID({
            collection: 'finance-accounts',
            id: idOf(data.toAccount) as number,
            depth: 0,
            req,
            overrideAccess: false,
          })
          if (to.kind !== 'card') fail('A card settlement must pay into a card account.')
        }
        return data
      },
    ],
  },
)

export const FinanceStatements = ledger(
  'finance-statements',
  [
    rel('account', 'finance-accounts', true),
    date('date'),
    { ...signedMoney('statementBalance'), required: true, label: 'Bank statement balance' },
    attachments(),
  ],
  {
    title: 'date',
    description: 'Balances read from a bank statement, compared against the recorded balance on that date.',
    references: [],
  },
)

export const FinanceFiles: CollectionConfig = {
  slug: 'finance-files',
  access: {
    create: financeAccess,
    read: financeAccess,
    update: financeAccess,
    delete: () => false,
  },
  admin: { group: 'Finance', description: 'Private finance proofs. Readable only with finance access.' },
  hooks: {
    beforeOperation: [
      ({ args, operation }) => {
        // Random stored names: a file's name never reveals the transaction behind it.
        const file = args.req?.file
        if (operation === 'create' && file) {
          const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, '')
          file.name = `${crypto.randomUUID()}${ext}`
        }
        return args
      },
    ],
  },
  fields: [text('description')],
  upload: {
    staticDir: path.resolve(dirname, '../../private/finance-files'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
  },
}

export const FinanceAuditLog: CollectionConfig = {
  slug: 'finance-audit-log',
  access: { create: () => false, read: financeAccess, update: () => false, delete: () => false },
  admin: { group: 'Finance', useAsTitle: 'targetCollection', defaultColumns: ['targetCollection', 'targetId', 'operation', 'reason', 'user', 'createdAt'] },
  fields: [
    { name: 'targetCollection', type: 'text', required: true, index: true },
    { name: 'targetId', type: 'text', required: true, index: true },
    { name: 'operation', type: 'text', required: true },
    { name: 'changes', type: 'json' },
    { name: 'reason', type: 'text' },
    { name: 'user', type: 'relationship', relationTo: 'users' },
  ],
  timestamps: true,
}

export const financeFundingCollections = [
  FinanceParticipants,
  FinanceAccounts,
  FinanceProjectRules,
  FinanceCampaigns,
  FinanceFunding,
  FinanceAdCharges,
  FinancePayouts,
  FinanceTransfers,
  FinanceStatements,
  FinanceFiles,
  FinanceAuditLog,
]
