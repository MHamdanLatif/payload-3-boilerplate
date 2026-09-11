import type { PaymentHead, InstallmentFrequencyKind } from './payment-heads'
import { FREQUENCY_MONTHS, isGreyHead, isFinishingHead, headEventCount } from './payment-heads'

export type { InstallmentFrequencyKind } from './payment-heads'

export type InstallmentInput = {
  kind: InstallmentFrequencyKind
  active: boolean
  locked: boolean
  /** PKR per period. Required when active+locked. For active+unlocked, this is the auto-computed value (overwritten by the engine). */
  valuePerPeriod: number
}

/** Fixed: entered DP drives the plan. Auto: entered installments determine DP. */
export type DownPaymentMode = 'fixed' | 'auto'

export type ComputeInput = {
  unitPrice: number
  loanIncluded: boolean
  loanAmount: number
  totalDurationMonths: number
  downPaymentPct: number
  possessionPct: number
  installments: InstallmentInput[]
  /** Active flag per head. Engine only includes enabled heads. UI enforces min-2 grey + min-2 finishing. */
  heads: PaymentHead[]
  availableHeads?: PaymentHead[]
  possessionCap?: number
  /** Optional. Defaults to 'fixed' (current behaviour). See `DownPaymentMode`. */
  dpMode?: DownPaymentMode
  /**
   * Admin's allowed down-payment range. Used to validate the derived DP
   * value in 'auto' mode. Defaults to [10, 100] when omitted.
   */
  downPaymentMinPct?: number
  downPaymentMaxPct?: number
}

export type PlanRowKind =
  | 'down-payment'
  | 'installment-monthly'
  | 'installment-quarterly'
  | 'installment-halfyearly'
  | 'milestone'
  | 'possession'
  | 'extra-charge'

export type PlanRow = {
  sourceId?: string
  category?: string
  kind: PlanRowKind
  label: string
  monthOffset: number
  amount: number
  cumulativeAmount: number
  cumulativePct: number
  /** For installment rows: 'Monthly'/'Quarterly'/'HalfYearly'. For milestone rows: head name. For DP: 'Down Payment'. */
  headName: string
}

export type PlanResult = {
  rows: PlanRow[]
  totals: {
    effectivePrice: number
    unitPrice: number
    loanAmount: number
    downPayment: number
    installmentTotal: number
    milestoneTotal: number
    greyTotal: number
    finishingTotal: number
    possession: number
  }
  cadence: {
    monthsPerPeriod: Record<InstallmentFrequencyKind, number>
    periodCount: Record<InstallmentFrequencyKind, number>
    activeFrequencies: InstallmentFrequencyKind[]
  }
  resolved: {
    installments: InstallmentInput[]
    activeGreyHeadNames: string[]
    activeFinishingHeadNames: string[]
    activeInitialHeadNames: string[]
  }
  warnings: string[]
}

export const DEFAULT_DISCLAIMER =
  'This generated payment plan is intended FOR ESTIMATION ONLY. ' +
  'It is NOT a binding offer and does NOT guarantee final builder approval. ' +
  'Rates and terms are subject to change without prior notice.'

const round2 = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

/** Fixed buyer amounts never absorb an unallocated balance. */
export function computePlan(input: ComputeInput): PlanResult {
  const warnings: string[] = []
  const safe = (n: number, label: string) => {
    if (!Number.isFinite(n) || n < 0 || n > 1e12) {
      warnings.push(`${label} must be a valid non-negative amount.`)
      return 0
    }
    return round2(n)
  }
  const unitPrice = safe(input.unitPrice, 'Unit price')
  const loanAmount = input.loanIncluded ? safe(input.loanAmount, 'Loan') : 0
  const T = round2(Math.max(0, unitPrice - loanAmount))
  if (T <= 0) warnings.push('The price after loan must be greater than zero.')
  const duration =
    Number.isInteger(input.totalDurationMonths) &&
    input.totalDurationMonths >= 1 &&
    input.totalDurationMonths <= 120
      ? input.totalDurationMonths
      : 0
  if (!duration) warnings.push('Duration must be a whole number of months between 1 and 120.')
  const available = (input.availableHeads ?? input.heads).filter((h) => h.enabled)
  const heads = input.heads.filter(
    (h) => h.enabled && available.some((a) => a.name === h.name && a.category === h.category),
  )
  const grey = heads.filter(isGreyHead)
  const finishing = heads.filter(isFinishingHead)
  const initial = heads.filter((h) => h.category === 'Initial Payment')
  for (const category of ['Grey Structure', 'Finishing'] as const) {
    const minimum = Math.min(2, available.filter((h) => h.category === category).length)
    if (heads.filter((h) => h.category === category).length < minimum)
      warnings.push(`Select at least ${minimum} ${category} payment heads.`)
  }
  const hasMilestones = available.some((h) => isGreyHead(h) || isFinishingHead(h))
  const auto = input.dpMode === 'auto'
  if (auto && hasMilestones)
    warnings.push('Calculate the down payment from installments only for plans without milestones.')
  const min = input.downPaymentMinPct ?? 10
  const max = input.downPaymentMaxPct ?? 100
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max)
    warnings.push('The project down payment range is invalid.')
  const dpPct = safe(input.downPaymentPct, 'Down payment percentage')
  if (!auto && (dpPct < min || dpPct > max))
    warnings.push(`Down payment must be between ${min}% and ${max}%.`)
  const cap = available.some((h) => h.category === 'Possession')
    ? Math.min(5, input.possessionCap ?? 5)
    : 0
  const possessionPct = safe(input.possessionPct, 'Possession percentage')
  if (possessionPct > cap) warnings.push(`Possession cannot exceed ${cap}%.`)
  const P = round2((T * clamp(possessionPct, 0, cap)) / 100)
  let DP = round2((T * clamp(dpPct, 0, 100)) / 100)
  const periodCount = {
    Monthly: Math.floor(duration),
    Quarterly: Math.floor(duration / 3),
    HalfYearly: Math.floor(duration / 6),
  }
  const kinds: InstallmentFrequencyKind[] = ['Monthly', 'Quarterly', 'HalfYearly']
  const names = {
    Monthly: 'Monthly Installments',
    Quarterly: 'Quarterly Installments',
    HalfYearly: 'Half Yearly Installments',
  }
  const installments = kinds.map((kind) => {
    const raw = input.installments.find((f) => f.kind === kind)
    const allowed = available.some((h) => h.category === 'Time-Based' && h.name === names[kind])
    if (raw?.active && !allowed)
      warnings.push(`${kind} installments are not available for this project.`)
    return {
      kind,
      active: Boolean(raw?.active && allowed),
      locked: Boolean(raw?.locked),
      valuePerPeriod: safe(raw?.valuePerPeriod ?? 0, `${kind} payment`),
    }
  })
  const active = installments.filter((f) => f.active)
  if (available.some((h) => h.category === 'Time-Based') && !active.length)
    warnings.push('Select at least one installment frequency.')
  if (active.some((f) => !periodCount[f.kind]))
    warnings.push('The selected frequency has no payments within this duration.')
  const manualTotal = round2(
    active
      .filter((f) => auto || f.locked)
      .reduce((s, f) => s + f.valuePerPeriod * periodCount[f.kind], 0),
  )
  if (auto) {
    DP = round2(T - P - manualTotal)
    if (DP < 0 || DP < (T * min) / 100 - 0.005 || DP > (T * max) / 100 + 0.005)
      warnings.push(
        `The calculated down payment must be between ${min}% and ${max}%. Adjust your installment amounts.`,
      )
  }
  const balance = round2(T - DP - P)
  if (balance < 0) warnings.push('Down payment and possession exceed the price.')
  let installmentPool = hasMilestones ? round2(Math.max(0, balance) / 2) : Math.max(0, balance)
  if (!active.length) installmentPool = 0
  const calculatedCount = active
    .filter((f) => !f.locked && !auto)
    .reduce((s, f) => s + periodCount[f.kind], 0)
  const remainder = round2(installmentPool - manualTotal)
  if (!auto && remainder < -0.005)
    warnings.push('Entered installment amounts exceed the installment budget. Reduce an amount.')
  const perEvent = calculatedCount
    ? Math.floor(Math.round(Math.max(0, remainder) * 100) / calculatedCount) / 100
    : 0
  const resolved = installments.map((f) => ({
    ...f,
    valuePerPeriod: !f.active ? 0 : auto || f.locked ? f.valuePerPeriod : perEvent,
  }))
  const rows: PlanRow[] = []
  const add = (
    kind: PlanRowKind,
    headName: string,
    label: string,
    monthOffset: number,
    amount: number,
    category?: string,
  ) => {
    rows.push({
      kind,
      headName,
      label,
      monthOffset,
      amount: round2(Math.max(0, amount)),
      cumulativeAmount: 0,
      cumulativePct: 0,
      category,
    })
  }
  add('down-payment', initial.map((h) => h.name).join(' + ') || 'Down Payment', 'At signing', 0, DP)
  for (const f of resolved.filter((f) => f.active)) {
    const kind: PlanRowKind =
      f.kind === 'Monthly'
        ? 'installment-monthly'
        : f.kind === 'Quarterly'
          ? 'installment-quarterly'
          : 'installment-halfyearly'
    for (let i = 1; i <= periodCount[f.kind]; i++) {
      const month = i * FREQUENCY_MONTHS[f.kind]
      add(kind, names[f.kind], `Month ${month}`, month, f.valuePerPeriod)
    }
  }
  // Only calculated payments may receive sub-rupee rounding adjustments.
  if (calculatedCount && remainder >= 0) {
    let tail = Math.round((remainder - perEvent * calculatedCount) * 100)
    for (const row of rows) {
      if (
        tail > 0 &&
        resolved.some((f) => f.active && !f.locked && names[f.kind] === row.headName)
      ) {
        row.amount = round2(row.amount + 0.01)
        tail--
      }
    }
  }
  const installmentTotal = round2(
    rows.filter((r) => r.kind.startsWith('installment-')).reduce((s, r) => s + r.amount, 0),
  )
  const milestonePool = hasMilestones ? Math.max(0, round2(balance - installmentTotal)) : 0
  const greyBudget = grey.length
    ? finishing.length
      ? round2(milestonePool / 2)
      : milestonePool
    : 0
  const finishingBudget = finishing.length ? round2(milestonePool - greyBudget) : 0
  for (const [group, budget] of [
    [grey, greyBudget],
    [finishing, finishingBudget],
  ] as const) {
    const expanded = group.flatMap((h) =>
      Array.from({ length: Math.min(50, Math.max(1, headEventCount(h))) }, (_, i) => ({ h, i })),
    )
    const budgetCents = Math.round(budget * 100)
    const perMilestoneCents = expanded.length ? Math.floor(budgetCents / expanded.length) : 0
    const tail = expanded.length ? budgetCents % expanded.length : 0
    expanded.forEach(({ h, i }, index) => {
      const amount = (perMilestoneCents + (index < tail ? 1 : 0)) / 100
      add(
        'milestone',
        headEventCount(h) > 1 ? `${h.name} #${i + 1}/${headEventCount(h)}` : h.name,
        'Milestone Payment',
        duration + 0.5,
        amount,
        h.category,
      )
    })
  }
  if (cap > 0 || P > 0) add('possession', 'Possession', 'At possession', duration + 1, P)
  rows.sort((a, b) => a.monthOffset - b.monthOffset)
  let cumulative = 0
  for (const row of rows) {
    cumulative = round2(cumulative + row.amount)
    row.cumulativeAmount = cumulative
    row.cumulativePct = T > 0 ? round2((cumulative / T) * 100) : 0
  }
  if (Math.abs(T - cumulative) > 0.005)
    warnings.push(
      `The schedule has PKR ${round2(T - cumulative).toLocaleString()} remaining. Choose "Calculate for me" for a payment or adjust your amounts.`,
    )
  const sum = (predicate: (r: PlanRow) => boolean) =>
    round2(rows.filter(predicate).reduce((s, r) => s + r.amount, 0))
  return {
    rows,
    totals: {
      effectivePrice: T,
      unitPrice,
      loanAmount,
      downPayment: sum((r) => r.kind === 'down-payment'),
      installmentTotal,
      milestoneTotal: sum((r) => r.kind === 'milestone'),
      greyTotal: sum((r) => r.category === 'Grey Structure'),
      finishingTotal: sum((r) => r.category === 'Finishing'),
      possession: P,
    },
    cadence: {
      monthsPerPeriod: FREQUENCY_MONTHS,
      periodCount,
      activeFrequencies: active.map((f) => f.kind),
    },
    resolved: {
      installments: resolved,
      activeGreyHeadNames: grey.map((h) => h.name),
      activeFinishingHeadNames: finishing.map((h) => h.name),
      activeInitialHeadNames: initial.map((h) => h.name),
    },
    warnings: [...new Set(warnings)],
  }
}

export function formatPlanMoney(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
