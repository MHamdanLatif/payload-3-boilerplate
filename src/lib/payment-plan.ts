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
import { FREQUENCY_MONTHS, isGreyHead, isFinishingHead, headEventCount } from './payment-heads'

export type { InstallmentFrequencyKind } from './payment-heads'

export type InstallmentInput = {
  kind: InstallmentFrequencyKind
  active: boolean
  locked: boolean
  /** PKR per period. Required when active+locked. For active+unlocked, this is the auto-computed value (overwritten by the engine). */
  valuePerPeriod: number
}

/**
 * `dpMode` controls which side of the equation is the absorber:
 *   - 'fixed' (default) — DP slider drives. Installments fit the budget.
 *      Locked installments take their stated values; unlocked share the
 *      remainder. If math doesn't balance (e.g. all installments are
 *      locked at values that fall short of the budget AND no milestones
 *      exist to absorb), a warning is emitted.
 *   - 'auto'             — DP is computed: DP = T − installments − possession.
 *      The buyer locks installment values; the engine derives a DP and
 *      validates it against the project's allowed down-payment range,
 *      emitting a warning if the derived value falls outside.
 *      Mode 'auto' is intended for projects WITHOUT milestone heads
 *      (ready-to-move / no-construction-phase plans). Milestone-phased
 *      projects fall back to 'fixed' even if the buyer toggles 'auto'.
 */
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

  // 3. Possession (computed before DP because possession is slider-controlled
  // in both modes; DP differs between modes)
  const possessionPct = clamp(input.possessionPct, 0, 5)
  const P = round2((T * possessionPct) / 100)

  // Are there milestone heads admin-enabled? Affects pool allocation +
  // forces 'fixed' DP mode (auto-DP is only meaningful for non-milestone plans).
  const hasMilestoneHeads = input.heads.some(
    (h) =>
      h.enabled && (h.category === 'Grey Structure' || h.category === 'Finishing'),
  )

  // 2. DP — depends on dpMode.
  // 'fixed' (default): DP = T × slider%. Installments fit the remaining budget.
  // 'auto':            DP = T − installments − P. Slider becomes a derived display.
  //                    Auto-DP downgrades to 'fixed' if milestones exist (the
  //                    equation has too many unknowns otherwise).
  const requestedMode: DownPaymentMode = input.dpMode ?? 'fixed'
  let effectiveMode: DownPaymentMode = requestedMode
  if (requestedMode === 'auto' && hasMilestoneHeads) {
    effectiveMode = 'fixed'
    warnings.push(
      'Auto Down Payment mode is not available for milestone-phased projects — using your slider value.',
    )
  }

  const dpMinPct = input.downPaymentMinPct ?? 10
  const dpMaxPct = input.downPaymentMaxPct ?? 100
  const dpPct = clamp(input.downPaymentPct, 10, 100)

  // In 'fixed' mode we know DP up-front. In 'auto' mode we delay it until
  // after installments have been valued, then derive it as the residual.
  let DP = effectiveMode === 'fixed' ? round2((T * dpPct) / 100) : 0

  // 4. Construction balance — in 'auto' mode this represents (T − P) initially
  // and gets corrected once DP is derived.
  let B = round2(T - DP - P)

  // 5. Split between time-based installments and milestones.
  // The 50/50 rule applies only when admin has milestone heads enabled to
  // receive funds. For ready-for-possession / no-milestone projects, 100%
  // of the construction budget flows to installments — otherwise the
  // milestone money has nowhere to go and ends up inflating possession
  // beyond its 5% cap via the drift-absorption step at the end.
  let installmentPool = hasMilestoneHeads ? round2(B * 0.5) : B
  let milestonePool = hasMilestoneHeads ? round2(B - installmentPool) : 0

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

  // Resolve per-frequency values. Two completely different flows:
  //
  // Mode 'fixed': DP is known. Compute installment pool from B = T-DP-P, sum
  //   locked spend, distribute the leftover across unlocked frequencies so
  //   every event of a given unlocked frequency carries the same amount.
  //
  // Mode 'auto':  DP unknown. Every active installment uses its stated value
  //   (lock is decorative in this mode — installments drive DP, not the
  //   other way around). After resolving, derive DP = T − Σinstallments − P
  //   and validate against admin's [min, max] range.
  let resolvedInstallments: InstallmentInput[]

  if (effectiveMode === 'fixed') {
    let lockedSum = 0
    for (const f of input.installments) {
      if (f.active && f.locked) {
        lockedSum += Math.max(0, f.valuePerPeriod) * periodCount[f.kind]
      }
    }
    lockedSum = round2(lockedSum)

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
        `Locked installments (PKR ${lockedSum.toLocaleString()}) exceed the time-based budget (PKR ${installmentPool.toLocaleString()}). Reduce a locked value or add a milestone head to absorb the balance.`,
      )
    }

    resolvedInstallments = input.installments.map((f) => {
      if (!f.active) return { ...f, valuePerPeriod: 0 }
      if (f.locked) return { ...f, valuePerPeriod: Math.max(0, f.valuePerPeriod) }
      return { ...f, valuePerPeriod: unlockedPerEvent }
    })
  } else {
    // 'auto' — all active installments carry their stated value.
    resolvedInstallments = input.installments.map((f) => ({
      ...f,
      valuePerPeriod: f.active ? Math.max(0, f.valuePerPeriod) : 0,
    }))

    const installmentTotal = round2(
      resolvedInstallments.reduce(
        (sum, f) => (f.active ? sum + f.valuePerPeriod * periodCount[f.kind] : sum),
        0,
      ),
    )

    DP = round2(T - installmentTotal - P)
    B = round2(T - DP - P) // == installmentTotal
    installmentPool = installmentTotal
    milestonePool = 0

    const computedDpPct = T > 0 ? round2((DP / T) * 100) : 0
    if (DP < 0) {
      warnings.push(
        `Installments (PKR ${installmentTotal.toLocaleString()}) plus possession exceed the total. Down Payment would be negative — reduce installment amounts.`,
      )
    } else if (computedDpPct < dpMinPct) {
      warnings.push(
        `Auto-computed Down Payment is ${computedDpPct}% (PKR ${DP.toLocaleString()}), below this project's minimum of ${dpMinPct}%. Lower the installments to push more into the down payment, or switch off Auto DP.`,
      )
    } else if (computedDpPct > dpMaxPct) {
      warnings.push(
        `Auto-computed Down Payment is ${computedDpPct}% (PKR ${DP.toLocaleString()}), above this project's maximum of ${dpMaxPct}%. Raise the installments to absorb more of the balance, or switch off Auto DP.`,
      )
    }
  }

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

  // Per-EVENT (not per-head) so Slab Casting with N slabs splits its allocation
  // across N events. Each grey/finishing casting is one payment trigger; total
  // events = sum of headEventCount over active heads.
  const activeGreyEventCount = activeGreyHeads.reduce((s, h) => s + headEventCount(h), 0)
  const activeFinishingEventCount = activeFinishingHeads.reduce(
    (s, h) => s + headEventCount(h),
    0,
  )
  const perGreyEvent =
    activeGreyEventCount > 0 ? round2(greyTotal / activeGreyEventCount) : 0
  const perFinishingEvent =
    activeFinishingEventCount > 0 ? round2(finishingTotal / activeFinishingEventCount) : 0

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

  // Milestone rows.
  //
  // Milestones are NOT pinned to a calendar month — they fire on construction
  // events (foundation cast, slab cast, plaster done, etc.) which slip with the
  // build. Spreading them across months 1..36 used to compete visually with the
  // time-based installments (buyer thought month-12 milestone replaced their
  // month-12 monthly payment). Now: every milestone shows "Milestone Payment"
  // in the When column and they sit between the last time-based installment
  // and Possession. Time-based installments still cover the full duration.
  //
  // Slab Casting expansion: a single head can fire multiple times (once per
  // slab). headEventCount(h) returns N; we emit N rows each carrying the head
  // name (suffixed with "#i/N" when N>1 so the buyer sees each slab payment).
  const milestoneRowsRaw: { headName: string; amount: number }[] = []
  for (const h of activeGreyHeads) {
    const n = headEventCount(h)
    for (let i = 0; i < n; i++) {
      milestoneRowsRaw.push({
        headName: n > 1 ? `${h.name} #${i + 1}/${n}` : h.name,
        amount: perGreyEvent,
      })
    }
  }
  for (const h of activeFinishingHeads) {
    const n = headEventCount(h)
    for (let i = 0; i < n; i++) {
      milestoneRowsRaw.push({
        headName: n > 1 ? `${h.name} #${i + 1}/${n}` : h.name,
        amount: perFinishingEvent,
      })
    }
  }
  // Park all milestones at duration+0.5 so they sort cleanly between the last
  // monthly installment (duration) and the Possession row (duration+1) without
  // suggesting a specific calendar month to the buyer.
  const milestoneOffset = input.totalDurationMonths + 0.5
  for (const m of milestoneRowsRaw) {
    cumulative = round2(cumulative + m.amount)
    rows.push({
      kind: 'milestone',
      label: 'Milestone Payment',
      monthOffset: milestoneOffset,
      amount: m.amount,
      cumulativeAmount: cumulative,
      cumulativePct: 0,
      headName: m.headName,
    })
  }

  // Possession row.
  // Drift = exact total minus what we've allocated so far minus possession.
  // Sources of drift:
  //   • Mode 'fixed' with a locked installment reduced below its computed
  //     share — the locked sub-pool under-spends and the gap has to go
  //     somewhere. Business rule: route it to milestones first (so all
  //     installments of a given frequency stay identical), then to the DP
  //     row. Never to an installment row — that would break the equal-
  //     payment-per-frequency rule the user has explicitly called out.
  //   • Mode 'auto' — DP was derived as the residual, so drift should be
  //     ≤ rounding noise. Absorb it into DP silently.
  //   • Tiny rounding from round2() splits in either mode — also DP-absorb.
  const possessionAmount = P
  const drift = round2(T - cumulative - possessionAmount)
  if (Math.abs(drift) > 0.005) {
    const milestoneIndices: number[] = []
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].kind === 'milestone') milestoneIndices.push(i)
    }
    const dpIdx = rows.findIndex((r) => r.kind === 'down-payment')

    if (effectiveMode === 'fixed' && milestoneIndices.length > 0) {
      // Spread drift evenly across milestone rows. Last row carries the
      // sub-rounding tail so cumulative lands exactly on T.
      const perMilestone = round2(drift / milestoneIndices.length)
      let distributed = 0
      for (let k = 0; k < milestoneIndices.length; k++) {
        const idx = milestoneIndices[k]
        const isLast = k === milestoneIndices.length - 1
        const delta = isLast ? round2(drift - distributed) : perMilestone
        rows[idx].amount = round2(rows[idx].amount + delta)
        distributed = round2(distributed + delta)
      }
    } else if (dpIdx >= 0) {
      rows[dpIdx].amount = round2(rows[dpIdx].amount + drift)
    } else if (drift > 0) {
      // Edge case: drift exists but there's no DP row and no milestones to
      // absorb it (admin disabled both, mode='fixed', dpPct=0). Synthesize
      // a Down Payment row at month 0 so the schedule still totals T.
      rows.unshift({
        kind: 'down-payment',
        label: 'At signing',
        monthOffset: 0,
        amount: round2(drift),
        cumulativeAmount: 0,
        cumulativePct: 0,
        headName: 'Down Payment',
      })
      DP = round2(DP + drift)
    }

    // Recompute every cumulative from scratch — the cheapest correct path
    // since we may have touched rows anywhere in the array.
    let running = 0
    for (const row of rows) {
      running = round2(running + row.amount)
      row.cumulativeAmount = running
    }
    cumulative = running
  }

  cumulative = round2(cumulative + possessionAmount)
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
