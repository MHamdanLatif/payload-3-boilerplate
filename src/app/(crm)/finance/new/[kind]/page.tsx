import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@payloadcms/db-postgres'
import { financeExec, ledgerOptions } from '@/lib/finance-server'
import { dealPosition, projectRules } from '@/lib/finance-ledger'
import { nowPKTInput, paisaRupees, param, positiveID, todayPKT, type FinanceParams } from '@/lib/finance-query'
import { ChargeLines, LedgerForm, SplitEditor, type Option, type SplitRow } from '@/components/finance/LedgerForm'
import { CommissionForm } from '@/components/finance/CommissionForm'
import type { EntryField } from '@/components/finance/EntryForm'

const TITLES: Record<string, [string, string]> = {
  participant: ['Add participant', 'Someone who funds projects or receives commission. You can add yourself.'],
  account: ['Add bank, cash or card account', 'Balances are recorded balances you enter, not live bank balances.'],
  rules: ['Funding and commission rules', 'Funding and commission percentages are independent. Each table must total 100%.'],
  preset: ['Add commission preset', 'A named arrangement, such as a referral split, to reuse on deals.'],
  campaign: ['Campaign', 'Planned budget only. Actual spending is recorded as advertising charges.'],
  funding: ['Record project funding', 'Only money actually received adds cash. Promises are tracked separately.'],
  'ad-charge': ['Record advertising charge', 'Enter the Meta amounts and the actual bank debit. The difference is shared by Meta amount.'],
  payout: ['Pay out / withdraw', 'Money paid from the business account to you or a partner, from this deal\'s commission.'],
  commission: ['Commission received', 'Money the builder paid you for this deal.'],
  transfer: ['Transfer between accounts', 'Moving your own money, or settling a card. Not an expense.'],
  statement: ['Enter bank statement balance', 'Compared with the recorded balance on that date.'],
  'deal-split': ['Commission distribution', 'Choose how this deal\'s commission is shared. Must total 100%.'],
  'deal-expense': ['Add deal expense', 'Only expenses that belong to this deal. Advertising is never deducted from commission.'],
  'expense-paid': ['Mark deal expense paid', 'Moves the reserved amount out of the account.'],
}

export default async function NewLedgerEntry({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<FinanceParams>
}) {
  const { kind } = await params
  const p = await searchParams
  if (!TITLES[kind]) notFound()
  const exec = await financeExec()
  const o = await ledgerOptions()
  const activePeople: Option[] = o.participants.filter((x) => !x.archived).map((x) => ({ value: String(x.id), label: x.name }))
  const accounts: Option[] = o.accounts
    .filter((x) => !x.archived)
    .map((x) => ({ value: String(x.id), label: `${x.name}${x.kind === 'card' ? ' (card)' : ''}${x.card_label ? ' · ' + x.card_label : ''}` }))
  const onlyAccount = accounts.length === 1 ? accounts[0].value : ''
  const project = positiveID(param(p, 'project'))
  const deal = positiveID(param(p, 'deal'))
  const fields: EntryField[] = []
  const hidden: Record<string, string> = {}
  const f = (name: string, label: string, extra: Partial<EntryField> = {}) => fields.push({ name, label, ...extra })
  const money = (name: string, label: string, required = true, value?: string) =>
    f(name, label, { type: 'number', step: '0.01', min: 0, required, value })
  const select = (name: string, label: string, options: Option[], extra: Partial<EntryField> = {}) =>
    f(name, label, { options, ...extra })
  const pick = (label: string) => [{ value: '', label }]
  const accountSelect = (name: string, label: string, required = true) =>
    select(name, label, [...pick(accounts.length ? 'Choose account' : 'No account yet: add one under Money'), ...accounts], { required, value: onlyAccount })
  let extra: React.ReactNode = null
  let files = false
  let back = '/finance'
  let context = ''

  let nothingOwed = ''
  let custom: React.ReactNode = null
  switch (kind) {
    case 'commission': {
      const pos = deal ? await dealPosition(exec, deal) : null
      if (!pos || pos.deal.cancelled) notFound()
      const rules = pos.deal.project_id ? await projectRules(exec, pos.deal.project_id) : null
      context = `${pos.deal.client_name} · ${pos.deal.project_name} · ${paisaRupees(pos.outstandingPaisa)} still to come`
      custom = (
        <CommissionForm
          deal={deal}
          entryKey={crypto.randomUUID()}
          outstanding={pos.outstandingPaisa / 100}
          today={todayPKT()}
          accounts={accounts}
          needsSplit={!pos.split.length}
          hasProjectDefault={Boolean(rules?.commission.length)}
          hasOwner={o.participants.some((x) => x.is_owner && !x.archived)}
          recipients={pos.recipients.map((r) => r.label)}
        />
      )
      back = `/finance/deals/${deal}`
      break
    }
    case 'participant': {
      const edit = positiveID(param(p, 'id'))
      const [row] = edit ? await exec(sql`SELECT * FROM finance_participants WHERE id=${edit}`) : []
      if (row) hidden.id = String(row.id)
      f('name', 'Name', { required: true, value: row?.name })
      f('phone', 'Phone (optional)', { type: 'tel', value: row?.phone || '', advanced: true })
      f('isOwner', 'This is me (Lateef Properties owner)', { type: 'checkbox', value: String(Boolean(row?.is_owner)) })
      f('notes', 'Notes (optional)', { type: 'textarea', value: row?.notes || '', advanced: true })
      back = '/finance/participants'
      break
    }
    case 'account': {
      const edit = positiveID(param(p, 'id'))
      const [row] = edit ? await exec(sql`SELECT * FROM finance_accounts WHERE id=${edit}`) : []
      const cls = edit ? await exec(sql`SELECT * FROM finance_accounts_opening_classification WHERE _parent_id=${edit}`) : []
      const c = (purpose: string) => cls.find((x) => x.purpose === purpose)
      if (row) hidden.id = String(row.id)
      f('name', 'Account name', { required: true, value: row?.name })
      select('accountKind', 'Type', [
        { value: 'bank', label: 'Bank account' },
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card that settles later' },
      ], { value: row?.kind || 'bank' })
      f('cardLabel', 'Card label (e.g. Visa 1234, never the full number)', { value: row?.card_label || '' })
      f('openingDate', 'Opening date (PKT)', { type: 'date', required: true, value: row?.opening_date ? new Date(new Date(row.opening_date).getTime() + 5 * 3600000).toISOString().slice(0, 10) : todayPKT() })
      f('openingBalance', 'Opening recorded balance (PKR, negative if a card is owed)', { type: 'number', step: '0.01', value: row ? String(row.opening_balance) : '0' })
      f('opening_owner', 'Of which: my own money (optional)', { type: 'number', step: '0.01', value: c('owner')?.amount ?? '' })
      f('opening_commission', 'Of which: commission retained pending distribution (optional)', { type: 'number', step: '0.01', value: c('commission')?.amount ?? '' })
      f('opening_other', 'Of which: other (optional)', { type: 'number', step: '0.01', value: c('other')?.amount ?? '' })
      f('opening_other_note', 'What the "other" amount is', { value: c('other')?.note || '' })
      f('notes', 'Notes (optional)', { type: 'textarea', value: row?.notes || '' })
      if (row) f('changeReason', 'Reason for changing opening figures (required if you change them)')
      context = 'Opening project funding is classified separately with "Opening balance (migration)" funding entries. Anything not classified is shown as unclassified, never assumed to be yours.'
      back = '/finance/accounts'
      break
    }
    case 'rules': {
      const rules = project ? await projectRules(exec, project) : null
      if (!rules) notFound()
      hidden.project = String(project)
      context = rules.title
      money('plannedDailyBudget', 'Planned daily budget for the whole project, all ads together (PKR)', true, String(rules.plannedDailyBudget ?? 5000))
      if (rules.id) f('changeReason', 'Reason for this change', { required: true })
      const toRows = (rows: Record<string, any>[]): SplitRow[] =>
        rows.map((r) => ({
          key: r.key || undefined,
          participant: r.participant_id ? String(r.participant_id) : undefined,
          recipientName: r.participant_id ? undefined : r.recipient_name || '',
          percent: String(r.percent),
          role: r.role || '',
        }))
      extra = (
        <>
          <SplitEditor name="funding" label="Funding percentages (who pays for this project's advertising)" participants={activePeople} initial={toRows(rules.funding)} allowOutside={false} showRole={false} />
          <SplitEditor name="commission" label="Default commission distribution (independent of funding)" participants={activePeople} initial={toRows(rules.commission)} />
          <p>Changes apply to new charges and new deals only. Posted charges and saved deal splits keep their own copy.</p>
        </>
      )
      back = `/finance/projects/${project}`
      break
    }
    case 'preset': {
      const rules = project ? await projectRules(exec, project) : null
      if (!rules) notFound()
      hidden.project = String(project)
      context = rules.title
      f('presetName', 'Preset name (e.g. "Referral by Ali")', { required: true })
      select('presetKind', 'Kind', [
        { value: 'referral', label: 'Referral (mark the referrer with role "Referrer")' },
        { value: 'custom', label: 'Custom' },
      ])
      if (rules.id) f('changeReason', 'Reason for this change', { required: true })
      extra = <SplitEditor name="lines" label="Preset distribution" participants={activePeople} initial={[]} />
      back = `/finance/projects/${project}`
      break
    }
    case 'campaign': {
      const edit = positiveID(param(p, 'id'))
      const [row] = edit ? await exec(sql`SELECT * FROM finance_campaigns WHERE id=${edit}`) : []
      const pid = row?.project_id || project
      const rules = pid ? await projectRules(exec, pid) : null
      if (!rules) notFound()
      hidden.project = String(pid)
      if (row) hidden.id = String(row.id)
      context = rules.title
      const local = (d: unknown) => (d ? new Date(new Date(String(d)).getTime() + 5 * 3600000).toISOString().slice(0, 16) : '')
      f('name', 'Campaign name', { required: true, value: row?.name })
      f('metaCampaignId', 'Meta campaign ID (optional)', { value: row?.meta_campaign_id || '' })
      f('startAt', 'Start date and time (PKT)', { type: 'datetime-local', required: true, value: local(row?.start_at) })
      f('endAt', 'End date and time (PKT, optional)', { type: 'datetime-local', value: local(row?.end_at) })
      money('dailyBudget', 'Planned daily budget (PKR)', true, String(row?.daily_budget ?? rules.plannedDailyBudget ?? 5000))
      money('fundingTarget', 'Planned funding target (PKR, optional)', false, row?.funding_target ?? '')
      select('status', 'Status', [
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
      ], { value: row?.status || 'active' })
      f('notes', 'Notes (optional)', { type: 'textarea', value: row?.notes || '' })
      back = `/finance/projects/${pid}`
      break
    }
    case 'funding': {
      const rules = project ? await projectRules(exec, project) : null
      if (!rules) notFound()
      hidden.project = String(project)
      context = rules.title
      const pledges = await exec(sql`SELECT f.id, f.amount, pa.name FROM finance_funding f JOIN finance_participants pa ON pa.id=f.participant_id WHERE f.project_id=${project} AND f.kind='pledge' AND NOT COALESCE(f.voided,false) ORDER BY f.date DESC`)
      select('fundingKind', 'Type', [
        { value: 'contribution', label: 'Contribution received (adds cash)' },
        { value: 'pledge', label: 'Promised funding (no cash yet)' },
        { value: 'refund', label: 'Refund to participant (cash out)' },
        { value: 'adjustment', label: 'Documented adjustment (no cash)' },
        { value: 'opening', label: 'Opening balance for migration (already in the account)' },
      ], { value: param(p, 'type') || 'contribution' })
      select('participant', 'Participant', [...pick('Choose participant'), ...activePeople], { required: true, value: param(p, 'participant') })
      select('campaign', 'Campaign (optional)', [...pick('No specific campaign'), ...o.campaigns.filter((c) => c.project_id === project).map((c) => ({ value: String(c.id), label: c.name }))], { advanced: true })
      money('amount', 'Amount (PKR)')
      select('direction', 'Direction (adjustments and openings only)', [
        { value: 'increase', label: 'Increases their balance' },
        { value: 'decrease', label: 'Decreases their balance' },
      ], { advanced: true })
      f('date', 'Date (PKT)', { type: 'date', required: true, value: todayPKT() })
      select('account', 'Receiving / paying account (not for promises or adjustments)', [...pick('No account'), ...accounts], { value: onlyAccount })
      if (pledges.length)
        select('pledge', 'Fulfils promise (optional)', [...pick('Not linked to a promise'), ...pledges.map((x) => ({ value: String(x.id), label: `${x.name} · Rs. ${Number(x.amount).toLocaleString('en-PK')}` }))], { advanced: true })
      f('paymentMethod', 'Payment method (optional)', { advanced: true })
      f('reference', 'Reference (optional)', { advanced: true })
      f('notes', 'Notes (required for adjustments)', { type: 'textarea', advanced: true })
      files = true
      context += ' · Funding is never commission income. Refunds are limited to the person\'s cash-backed balance in this project.'
      back = `/finance/projects/${project}`
      break
    }
    case 'ad-charge': {
      const now = nowPKTInput()
      f('date', 'Transaction date and time (PKT)', { type: 'datetime-local', required: true, value: now })
      accountSelect('account', 'Bank or card account debited')
      f('metaReference', 'Meta receipt / transaction reference')
      f('cardLabel', 'Card label (optional, e.g. Visa 1234)', { advanced: true })
      f('chargeBreakdown', 'Known breakdown of additional bank charges/taxes (optional)', { type: 'textarea', advanced: true })
      f('notes', 'Notes (optional)', { type: 'textarea', advanced: true })
      files = true
      const campaigns = o.campaigns.map((c) => ({ value: String(c.id), label: `${c.project_title} · ${c.name}${c.status === 'completed' ? ' (completed)' : ''}` }))
      extra = <ChargeLines campaigns={campaigns} />
      context = 'Additional bank charges/taxes = actual bank debit − Meta amounts. They may include other fees or currency differences, so they are not labelled as confirmed tax. Each campaign\'s cost is then split by its project\'s funding percentages.'
      back = '/finance/ad-charges'
      break
    }
    case 'payout': {
      const pos = deal ? await dealPosition(exec, deal) : null
      if (!pos) notFound()
      hidden.deal = String(deal)
      context = `${pos.deal.client_name} · ${pos.deal.project_name}`
      const owed = pos.recipients.filter((r) => r.unpaidPaisa > 0)
      if (!owed.length) {
        nothingOwed = pos.recipients.length
          ? 'Nothing is owed on this deal yet. Record the commission received first; you can mark it as already paid out there.'
          : 'Say who shares this commission first. On the deal page, tap "All mine (100%)" or set a split.'
        break
      }
      const chosen = owed.find((r) => r.key === param(p, 'recipient')) || (owed.length === 1 ? owed[0] : undefined)
      select('recipientKey', 'Recipient', [
        ...(chosen ? [] : pick('Choose recipient')),
        ...owed.map((r) => ({ value: r.key, label: `${r.label} · owed ${paisaRupees(r.unpaidPaisa)}` })),
      ], { required: true, value: chosen?.key })
      money('amount', 'Amount paid (PKR)', true, chosen ? String(chosen.unpaidPaisa / 100) : undefined)
      f('date', 'Payment date (PKT)', { type: 'date', required: true, value: todayPKT() })
      accountSelect('account', 'Paid from account')
      select('paymentMethod', 'Payment method', ['Bank transfer', 'Withdrawal to my account', 'Cash', 'Cheque'].map((m) => ({ value: m, label: m })))
      f('reference', 'Reference (optional)', { advanced: true })
      f('notes', 'Notes (optional)', { type: 'textarea', advanced: true })
      files = true
      back = `/finance/deals/${deal}`
      break
    }
    case 'transfer': {
      f('date', 'Date (PKT)', { type: 'date', required: true, value: todayPKT() })
      select('fromAccount', 'From account', [...pick('Choose account'), ...accounts], { required: true })
      select('toAccount', 'To account', [...pick('Choose account'), ...accounts], { required: true })
      money('amount', 'Amount (PKR)')
      select('transferKind', 'Type', [
        { value: 'transfer', label: 'Transfer between my accounts' },
        { value: 'card-settlement', label: 'Card settlement (paying off a card)' },
      ])
      f('reference', 'Reference (optional)', { advanced: true })
      f('notes', 'Notes (optional)', { type: 'textarea', advanced: true })
      files = true
      back = '/finance/accounts'
      break
    }
    case 'statement': {
      select('account', 'Account', [...pick('Choose account'), ...accounts], { required: true, value: param(p, 'account') || onlyAccount })
      f('date', 'Statement date (PKT)', { type: 'date', required: true, value: todayPKT() })
      f('statementBalance', 'Balance shown on the statement (PKR)', { type: 'number', step: '0.01', required: true })
      f('notes', 'Notes (optional)', { type: 'textarea' })
      files = true
      back = '/finance/accounts'
      break
    }
    case 'deal-split': {
      const pos = deal ? await dealPosition(exec, deal) : null
      if (!pos) notFound()
      const rules = pos.deal.project_id ? await projectRules(exec, pos.deal.project_id) : null
      hidden.deal = String(deal)
      context = `${pos.deal.client_name} · ${pos.deal.project_name}`
      const preset = rules?.presets.find((x) => String(x.id) === param(p, 'preset'))
      const mode = param(p, 'mode') || (preset ? preset.kind : pos.deal.commission_mode || (rules?.commission.length ? 'project-default' : 'custom'))
      const source = preset
        ? preset.lines
        : mode === 'project-default' && param(p, 'mode')
          ? rules?.commission || []
          : pos.split.length
            ? pos.split
            : rules?.commission || []
      const initial: SplitRow[] = source.map((r: Record<string, any>) => ({
        // Keep recipient keys of the saved split so earlier payouts stay attached.
        key: pos.split.find((s) => s.key === r.key) ? r.key : undefined,
        participant: r.participant_id ? String(r.participant_id) : undefined,
        recipientName: r.participant_id ? undefined : r.recipient_name || '',
        percent: String(r.percent),
        role: r.role || '',
      }))
      select('commissionMode', 'Distribution mode', [
        { value: 'project-default', label: 'Project default' },
        { value: 'referral', label: 'Referral' },
        { value: 'custom', label: 'Custom' },
      ], { value: mode })
      f('referrerName', 'Referring person (referral only; may be outside the register)', { value: pos.deal.referrer_name || '' })
      select('campaign', 'Originating campaign (optional; leave empty if unknown)', [
        ...pick('Unknown / not linked'),
        ...o.campaigns.filter((c) => c.project_id === pos.deal.project_id).map((c) => ({ value: String(c.id), label: c.name })),
      ], { value: pos.deal.campaign_id ? String(pos.deal.campaign_id) : '' })
      if (pos.split.length) f('changeReason', 'Reason for changing the split', { required: true })
      extra = (
        <>
          <p>
            Load:{' '}
            {rules?.commission.length ? <Link href={`?deal=${deal}&mode=project-default`}>project default</Link> : 'no project default set'}
            {rules?.presets.map((x) => (
              <span key={x.id}>
                {' · '}
                <Link href={`?deal=${deal}&preset=${x.id}`}>{x.name}</Link>
              </span>
            ))}
          </p>
          <SplitEditor name="commissionSplit" label="Recipients and percentages" participants={activePeople} initial={initial} />
          <p>A referrer who receives a percentage is a recipient here. An external broker fee is a deal expense deducted before distribution instead. Do not record the same payment both ways.</p>
        </>
      )
      back = `/finance/deals/${deal}`
      break
    }
    case 'deal-expense': {
      const [d] = deal ? await exec(sql`SELECT id, client_name, cancelled FROM finance_deals WHERE id=${deal}`) : []
      if (!d) notFound()
      hidden.deal = String(deal)
      context = d.client_name + (d.cancelled ? ' · cancelled deal: explain the correction in the notes' : '')
      f('vendor', 'Payee', { required: true })
      money('amount', 'Amount (PKR)')
      f('description', 'Description', { required: true })
      f('category', 'Category', { value: 'Broker fee', advanced: true })
      f('date', 'Date (PKT)', { type: 'date', required: true, value: todayPKT() })
      select('preDistribution', 'Deducted before commission distribution?', [
        { value: '', label: 'Choose' },
        { value: 'true', label: 'Yes, this deal-specific expense reduces distributable commission' },
        { value: 'false', label: 'No, record it but do not deduct it' },
      ], { required: true })
      select('paymentStatus', 'Status', [
        { value: 'paid', label: 'Paid' },
        { value: 'unpaid', label: 'Unpaid (reserve it; no cash moves yet)' },
      ])
      select('account', 'Paid from account (if paid)', [...pick('No account'), ...accounts], { value: onlyAccount })
      f('paymentMethod', 'Payment method (if paid)', { advanced: true })
      f('reference', 'Reference (if paid)', { advanced: true })
      f('notes', 'Notes', { type: 'textarea', advanced: true })
      files = true
      back = `/finance/deals/${deal}`
      break
    }
    case 'expense-paid': {
      const eid = positiveID(param(p, 'id'))
      const [e] = eid ? await exec(sql`SELECT * FROM finance_expenses WHERE id=${eid} AND payment_status='unpaid' AND NOT COALESCE(voided,false)`) : []
      if (!e) notFound()
      hidden.id = String(eid)
      context = `${e.vendor || ''} · ${e.description} · Rs. ${Number(e.amount).toLocaleString('en-PK')}`
      f('paidDate', 'Date paid (PKT)', { type: 'date', required: true, value: todayPKT() })
      accountSelect('account', 'Paid from account')
      f('paymentMethod', 'Payment method')
      f('reference', 'Reference (optional)', { advanced: true })
      back = e.deal_id ? `/finance/deals/${e.deal_id}` : '/finance/expenses'
      break
    }
  }
  const [title, help] = TITLES[kind]
  return (
    <>
      <h1>{title}</h1>
      {context && (
        <p>
          <strong>{context}</strong>
        </p>
      )}
      <p>{help}</p>
      {nothingOwed ? (
        <p role="alert">
          {nothingOwed} <Link href={back}>Open the deal</Link>
        </p>
      ) : (
        custom || (
          <LedgerForm kind={kind === 'preset' ? 'preset-add' : kind} entryKey={crypto.randomUUID()} fields={fields} hidden={hidden} files={files}>
            {extra}
          </LedgerForm>
        )
      )}
      <p>
        <Link href={back}>Back</Link> · All amounts are in PKR; dates are Pakistan time.
      </p>
    </>
  )
}
