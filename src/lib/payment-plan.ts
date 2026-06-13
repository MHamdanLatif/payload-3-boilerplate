/**
 * Payment Plan compute engine v2.
 *
 * Buyer inputs (set in the calculator):
 *   - downPaymentPct (10..100)
 *   - possessionPct (0..5)
 *   - loanIncluded (toggle) + loanAmount (from the chosen unit)
 *   - For each time-based frequency (Monthly, Quarterly, HalfYearly):
 *       active: boolean (at least one must be active)
 *       locked: boolean
 *       valuePerPeriod: number  (PKR per period; user-set when locked, auto when unlocked)
 *   - Milestone heads list (Grey + Finishing) — buyer can toggle individuals on/off
 *       UI enforces minimum 2 active grey + 2 active finishing
 *
 * Admin inputs (per-project):
 *   - totalDurationMonths
 *   - downPaymentMinPct / downPaymentMaxPct
 *   - possessionPct cap (≤ 5)
 *   - paymentHeads (the master toggle list)
 *
 * Compute pipeline:
 *   1. Effective price T = unitPrice − loanAmount (if loanIncluded) else unitPrice
 *   2. Down Payment   DP = T × dpPct / 100
 *      → split equally across enabled Initial-Payment heads
 *   3. Possession     P  = T × possessionPct / 100  (capped at 5)
 *   4. Construction-period balance B = T − DP − P
 *   5. Hard 50/50 split:
 *        installmentPool = B × 0.5
 *        milestonePool   = B × 0.5
 *   6. Time-based installments:
 *        For each ACTIVE+LOCKED frequency: spend = valuePerPeriod × periodCount
 *        lockedSum = Σ
 *        unlockedRemainder = installmentPool − lockedSum  (≥ 0 or returns validation error)
 *        Distribute unlockedRemainder across ACTIVE+UNLOCKED periods equally per event.
 *   7. Milestones (50/50 split of milestonePool):
 *        greyTotal = milestonePool / 2
 *        finishingTotal = milestonePool / 2
 *        Each active grey head gets greyTotal / activeGreyCount
 *        Each active finishing head gets finishingTotal / activeFinishingCount
 *   8. Possession-lowered overflow:
 *        If buyer sets possession below 5, the freed amount is already in B
 *        (so it flows through to installments + milestones via the 50/50 split).
 *        No separate "rollover" calc needed — it's structural.
 *
 * Business-rule invariants (all guaranteed by construction):
 *   - Possession ≤ 5% (clamped at input)
 *   - Down Payment 10–100% (clamped at input)
 *   - Construction budget always covers grey+finishing 50/50
 */

import type { PaymentHead, InstallmentFrequencyKind } from './payment-heads'
import { FREQUENCY_MONTHS, isGreyHead, isFinishingHead } from './payment-heads'

export type { InstallmentFrequencyKind } from './payment-heads'

export type InstallmentInput = {
  kind: InstallmentFrequencyKind
  active: boolean
  locked: boolean
  /** PKR per period. Required when active+locked. For active+unlocked, this is the auto-computed value (overwritten by the engine). */
  valuePerPeriod: number
}

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
}

export type PlanRowKind =
  | 'down-payment'
  | 'installment-monthly'
  | 'installment-quarterly'
  | 'installment-halfyearly'
  | 'milestone'
  | 'possession'

export type PlanRow = {
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

export function computePlan(input: ComputeInput): PlanResult {
  const warnings: string[] = []

  // 1. Effective price
  const unitPrice = Math.max(0, input.unitPrice)
  const loanAmount = input.loanIncluded ? Math.max(0, input.loanAmount) : 0
  const T = Math.max(0, unitPrice - loanAmount)

  // 2. DP
  const dpPct = clamp(input.downPaymentPct, 10, 100)
  const DP = round2((T * dpPct) / 100)

  // 3. Possession
  const possessionPct = clamp(input.possessionPct, 0, 5)
  const P = round2((T * possessionPct) / 100)

  // 4. Construction balance
  const B = round2(T - DP - P)

  // 5. 50/50 split
  const installmentPool = round2(B * 0.5)
  const milestonePool = round2(B - installmentPool)

  // 6. Time-based installments
  const periodCount: Record<InstallmentFrequencyKind, number> = {
    Monthly: Math.max(0, Math.floor(input.totalDurationMonths / FREQUENCY_MONTHS.Monthly)),
    Quarterly: Math.max(0, Math.floor(input.totalDurationMonths / FREQUENCY_MONTHS.Quarterly)),
    HalfYearly: Math.max(0, Math.floor(input.totalDurationMonths / FREQUENCY_MONTHS.HalfYearly)),
  }
  const activeFrequencies = input.installments
    .filter((f) => f.active)
    .map((f) => f.kind)

  // Only enforce "≥ 1 active" when the admin has actually enabled at least one
  // Time-Based head. If the admin disabled all three, the project just has no
  // time-based installments and the milestone pool absorbs the budget.
  const adminEnabledTimeBasedCount = input.heads.filter(
    (h) => h.enabled && h.category === 'Time-Based',
  ).length
  if (adminEnabledTimeBasedCount > 0 && activeFrequencies.length === 0) {
    warnings.push('At least one installment frequency must be active.')
  }

  // Locked installment spend
  let lockedSum = 0
  for (const f of input.installments) {
    if (f.active && f.locked) {
      lockedSum += Math.max(0, f.valuePerPeriod) * periodCount[f.kind]
    }
  }
  lockedSum = round2(lockedSum)

  // Distribute the remainder across active+unlocked periods (equal per-event).
  const unlockedRemainder = round2(installmentPool - lockedSum)
  let unlockedPerEvent = 0
  const unlockedFreqs = input.installments.filter((f) => f.active && !f.locked)
  const unlockedPeriodCount = unlockedFreqs.reduce(
    (s, f) => s + periodCount[f.kind],
    0,
  )
  if (unlockedPeriodCount > 0 && unlockedRemainder >= 0) {
    unlockedPerEvent = round2(unlockedRemainder / unlockedPeriodCount)
  } else if (unlockedRemainder < 0) {
    warnings.push(
      `Locked installments (PKR ${lockedSum.toLocaleString()}) exceed the time-based budget (PKR ${installmentPool.toLocaleString()}). Reduce a locked value.`,
    )
  }

  // Resolve per-frequency values (locked stay; unlocked filled in)
  const resolvedInstallments: InstallmentInput[] = input.installments.map((f) => {
    if (!f.active) return { ...f, valuePerPeriod: 0 }
    if (f.locked) return { ...f, valuePerPeriod: Math.max(0, f.valuePerPeriod) }
    return { ...f, valuePerPeriod: unlockedPerEvent }
  })

  // 7. Milestones
  const activeGreyHeads = input.heads.filter((h) => h.enabled && isGreyHead(h))
  const activeFinishingHeads = input.heads.filter((h) => h.enabled && isFinishingHead(h))
  const activeInitialHeads = input.heads.filter(
    (h) => h.enabled && h.category === 'Initial Payment',
  )

  // Only enforce min-2 when the admin has enabled ≥2 in that category. If admin
  // restricts the project to fewer, that's the admin's call and the buyer can't
  // make it worse — no warning needed.
  const adminGreyAvailable = input.heads.filter(
    (h) => h.enabled && h.category === 'Grey Structure',
  ).length
  const adminFinishingAvailable = input.heads.filter(
    (h) => h.enabled && h.category === 'Finishing',
  ).length
  if (adminGreyAvailable >= 2 && activeGreyHeads.length < 2)
    warnings.push('At least 2 early-stage milestones must be active.')
  if (adminFinishingAvailable >= 2 && activeFinishingHeads.length < 2)
    warnings.push('At least 2 late-stage milestones must be active.')

  const greyTotal = round2(milestonePool * 0.5)
  const finishingTotal = round2(milestonePool - greyTotal)
  const perGrey =
    activeGreyHeads.length > 0 ? round2(greyTotal / activeGreyHeads.length) : 0
  const perFinishing =
    activeFinishingHeads.length > 0
      ? round2(finishingTotal / activeFinishingHeads.length)
      : 0

  // 8. Build the row schedule
  const rows: PlanRow[] = []
  let cumulative = 0

  // Down Payment row(s) — one row labelled "Down Payment" listing the active initial heads inline.
  if (DP > 0) {
    cumulative = round2(cumulative + DP)
    const initialNames = activeInitialHeads.map((h) => h.name).join(' + ')
    rows.push({
      kind: 'down-payment',
      label: 'At signing',
      monthOffset: 0,
      amount: DP,
      cumulativeAmount: cumulative,
      cumulativePct: 0,
      headName: initialNames || 'Down Payment',
    })
  }

  // Time-based installments — one row per event, labelled by month + frequency.
  // Compounding is implicit: multiple frequencies firing on the same month produce
  // distinct rows for that month (e.g. Month 6 → Monthly #6 + Quarterly #2 + HY #1).
  type Event = {
    month: number
    kind: PlanRowKind
    headName: string
    amount: number
  }
  const events: Event[] = []
  for (const f of resolvedInstallments) {
    if (!f.active) continue
    const months = FREQUENCY_MONTHS[f.kind]
    const count = periodCount[f.kind]
    const rowKind: PlanRowKind =
      f.kind === 'Monthly'
        ? 'installment-monthly'
        : f.kind === 'Quarterly'
          ? 'installment-quarterly'
          : 'installment-halfyearly'
    const headName =
      f.kind === 'Monthly'
        ? 'Monthly Installment'
        : f.kind === 'Quarterly'
          ? 'Quarterly Installment'
          : 'Half-Yearly Installment'
    for (let i = 1; i <= count; i++) {
      events.push({
        month: i * months,
        kind: rowKind,
        headName,
        amount: f.valuePerPeriod,
      })
    }
  }

  // Sort by month, then by cadence (Monthly first → Quarterly → HalfYearly) so same-month rows appear in stable order.
  const cadenceRank: Record<PlanRowKind, number> = {
    'down-payment': -1,
    'installment-monthly': 0,
    'installment-quarterly': 1,
    'installment-halfyearly': 2,
    milestone: 3,
    possession: 4,
  }
  events.sort((a, b) => a.month - b.month || cadenceRank[a.kind] - cadenceRank[b.kind])

  for (const ev of events) {
    cumulative = round2(cumulative + ev.amount)
    rows.push({
      kind: ev.kind,
      label: `Month ${ev.month}`,
      monthOffset: ev.month,
      amount: ev.amount,
      cumulativeAmount: cumulative,
      cumulativePct: 0,
      headName: ev.headName,
    })
  }

  // Milestone rows — single list, no Grey/Finishing labels exposed.
  // Spread grey then finishing across the construction period for a natural schedule.
  const milestoneRowsRaw: { headName: string; amount: number; month: number }[] = []
  const greyHalfEnd = Math.max(1, Math.floor(input.totalDurationMonths / 2))
  if (activeGreyHeads.length > 0) {
    const gStep = greyHalfEnd / activeGreyHeads.length
    activeGreyHeads.forEach((h, i) => {
      const month = Math.max(1, Math.round((i + 1) * gStep))
      milestoneRowsRaw.push({ headName: h.name, amount: perGrey, month })
    })
  }
  if (activeFinishingHeads.length > 0) {
    const fStep = (input.totalDurationMonths - greyHalfEnd) / activeFinishingHeads.length
    activeFinishingHeads.forEach((h, i) => {
      const month = greyHalfEnd + Math.max(1, Math.round((i + 1) * fStep))
      milestoneRowsRaw.push({
        headName: h.name,
        amount: perFinishing,
        month: Math.min(input.totalDurationMonths, month),
      })
    })
  }
  milestoneRowsRaw.sort((a, b) => a.month - b.month)
  for (const m of milestoneRowsRaw) {
    cumulative = round2(cumulative + m.amount)
    rows.push({
      kind: 'milestone',
      label: `Month ${m.month}`,
      monthOffset: m.month,
      amount: m.amount,
      cumulativeAmount: cumulative,
      cumulativePct: 0,
      headName: m.headName,
    })
  }

  // Possession row — absorbs rounding drift to land exactly at T.
  const drift = round2(T - cumulative - P)
  const possessionAmount = round2(P + drift)
  cumulative = T
  rows.push({
    kind: 'possession',
    label: 'At possession',
    monthOffset: input.totalDurationMonths + 1,
    amount: possessionAmount,
    cumulativeAmount: cumulative,
    cumulativePct: 100,
    headName: 'Possession',
  })

  // Backfill cumulative %
  for (const row of rows) {
    row.cumulativePct = T > 0 ? round2((row.cumulativeAmount / T) * 100) : 0
  }

  const installmentTotal = round2(
    events.reduce((s, e) => s + e.amount, 0),
  )

  return {
    rows,
    totals: {
      effectivePrice: T,
      unitPrice,
      loanAmount,
      downPayment: DP,
      installmentTotal,
      milestoneTotal: milestonePool,
      greyTotal,
      finishingTotal,
      possession: possessionAmount,
    },
    cadence: {
      monthsPerPeriod: FREQUENCY_MONTHS,
      periodCount,
      activeFrequencies,
    },
    resolved: {
      installments: resolvedInstallments,
      activeGreyHeadNames: activeGreyHeads.map((h) => h.name),
      activeFinishingHeadNames: activeFinishingHeads.map((h) => h.name),
      activeInitialHeadNames: activeInitialHeads.map((h) => h.name),
    },
    warnings,
  }
}
