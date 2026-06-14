'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, FileDown, Lock, Unlock } from 'lucide-react'
import type { FeaturedProject } from '@/payload-types'
import { formatPkr, smallestUnit } from '@/lib/featured-projects'
import {
  computePlan,
  type ComputeInput,
  type InstallmentFrequencyKind,
  type InstallmentInput,
  type PlanResult,
} from '@/lib/payment-plan'
import {
  DEFAULT_PAYMENT_HEADS,
  frequencyFromHeadName,
  type PaymentHead,
  type PaymentHeadCategory,
} from '@/lib/payment-heads'
import { SectionRule } from '@/components/landing/SectionRule'
import { PaymentPlanPdfModal } from './PaymentPlanPdfModal'
import { cn } from '@/utilities/cn'

type Props = {
  project: FeaturedProject
  sectionNumber?: string
}

type ProjectHead = NonNullable<NonNullable<FeaturedProject['paymentPlan']>['paymentHeads']>[number]

const FREQUENCY_LABEL: Record<InstallmentFrequencyKind, string> = {
  Monthly: 'Monthly',
  Quarterly: 'Quarterly',
  HalfYearly: 'Half-Yearly',
}

export function PaymentPlanCalculator({
  project,
  sectionNumber = '02 / PAYMENT PLAN',
}: Props) {
  const config = project.paymentPlan
  const enabled = config?.enabled !== false

  // ── Resolve heads list (from project; fall back to defaults if unset) ─────
  const projectHeads: PaymentHead[] = useMemo(() => {
    const raw = (config?.paymentHeads ?? []) as ProjectHead[]
    if (!raw.length) {
      return DEFAULT_PAYMENT_HEADS.map((h) => ({ ...h }))
    }
    return raw.map((h) => ({
      name: h.name ?? '',
      category: h.category as PaymentHeadCategory,
      enabled: h.enabled ?? true,
      isCustom: h.isCustom ?? false,
    }))
  }, [config?.paymentHeads])

  // Only admin-enabled heads reach the buyer. The buyer can further toggle within these.
  const adminEnabledHeads = useMemo(
    () => projectHeads.filter((h) => h.enabled),
    [projectHeads],
  )

  // Time-Based: admin chooses which frequency rows the buyer ever sees.
  const adminAvailableFrequencies = useMemo<InstallmentFrequencyKind[]>(() => {
    const kinds: InstallmentFrequencyKind[] = []
    for (const h of adminEnabledHeads) {
      if (h.category !== 'Time-Based') continue
      const kind = frequencyFromHeadName(h.name)
      if (kind && !kinds.includes(kind)) kinds.push(kind)
    }
    return kinds
  }, [adminEnabledHeads])

  // Possession: admin can hide the slider entirely by disabling the Possession head.
  const possessionAdminEnabled = useMemo(
    () => adminEnabledHeads.some((h) => h.category === 'Possession'),
    [adminEnabledHeads],
  )

  // Buyer-side overrides — start with admin-enabled set.
  const [buyerEnabledHeadNames, setBuyerEnabledHeadNames] = useState<Set<string>>(
    () => new Set(adminEnabledHeads.map((h) => h.name)),
  )

  // ── Unit selection ──────────────────────────────────────────────────────
  const unitTypes = project.unitTypes ?? []
  const [selectedUnitKey, setSelectedUnitKey] = useState<string>(() => {
    const sm = smallestUnit(project)
    if (sm) return `${sm.type}::${sm.rooms}::${sm.price}`
    return ''
  })

  const selectedUnit = useMemo(() => {
    if (!selectedUnitKey || !unitTypes.length) return null
    return (
      unitTypes.find(
        (u) => `${u.type}::${u.rooms}::${u.price}` === selectedUnitKey,
      ) ?? null
    )
  }, [selectedUnitKey, unitTypes])

  const unitPrice =
    selectedUnit?.price ??
    config?.priceOverride ??
    project.startingPrice ??
    smallestUnit(project)?.price ??
    0

  const unitLoanAmount = selectedUnit?.loanAmount ?? 0

  // ── Loan toggle ─────────────────────────────────────────────────────────
  const [loanIncluded, setLoanIncluded] = useState(false)

  // ── DP, Possession ──────────────────────────────────────────────────────
  const minDown = Math.max(10, config?.downPaymentMinPct ?? 10)
  const maxDown = Math.min(100, config?.downPaymentMaxPct ?? 30)
  const possessionCap = Math.min(5, config?.possessionPct ?? 5)
  const totalDuration = config?.totalDurationMonths ?? 36

  const [downPaymentPct, setDownPaymentPct] = useState<number>(
    Math.round((minDown + maxDown) / 2),
  )
  const [possessionPct, setPossessionPct] = useState<number>(
    possessionAdminEnabled ? possessionCap : 0,
  )

  // If admin toggles Possession off after page render, force possessionPct to 0.
  // (Initial render handled above; this guards re-renders.)
  const effectivePossessionPct = possessionAdminEnabled ? possessionPct : 0

  // ── Installment frequencies ─────────────────────────────────────────────
  // Always carry all three kinds in state so toggling at the admin level later
  // doesn't lose any in-flight buyer input. Render filters by adminAvailable.
  // First admin-available kind starts active, others inactive.
  const [installments, setInstallments] = useState<InstallmentInput[]>(() => {
    const first = adminAvailableFrequencies[0]
    return (['Monthly', 'Quarterly', 'HalfYearly'] as InstallmentFrequencyKind[]).map(
      (kind) => ({
        kind,
        active: kind === first,
        locked: false,
        valuePerPeriod: 0,
      }),
    )
  })

  // Filter installments to admin-allowed kinds before passing to the engine —
  // disabled kinds are treated as if they didn't exist.
  const installmentsForEngine = useMemo<InstallmentInput[]>(
    () =>
      installments.filter((f) => adminAvailableFrequencies.includes(f.kind)),
    [installments, adminAvailableFrequencies],
  )

  // ── Apply unit's defaultPlan whenever the selected unit changes ─────────
  // This is the "builder's actual plan" feature — admins fill out the per-unit
  // defaultPlan in /admin → Featured Projects → Unit Types → Builder Default
  // Payment Plan, and the calculator opens with those exact values on first
  // load + whenever the buyer switches units. Buyer can adjust after.
  useEffect(() => {
    const dp = selectedUnit?.defaultPlan
    if (dp) {
      if (typeof dp.downPaymentPct === 'number') {
        setDownPaymentPct(
          Math.min(maxDown, Math.max(minDown, dp.downPaymentPct)),
        )
      }
      if (typeof dp.possessionPct === 'number') {
        setPossessionPct(
          possessionAdminEnabled
            ? Math.min(possessionCap, Math.max(0, dp.possessionPct))
            : 0,
        )
      }
      const defaultRows = Array.isArray(dp.installments) ? dp.installments : []
      if (defaultRows.length > 0) {
        const lookup = new Map<
          InstallmentFrequencyKind,
          { amount: number; locked: boolean }
        >()
        for (const r of defaultRows) {
          if (!r) continue
          const freq = r.frequency as InstallmentFrequencyKind
          if (!freq || typeof r.amount !== 'number') continue
          lookup.set(freq, { amount: r.amount, locked: r.locked !== false })
        }
        setInstallments(
          (['Monthly', 'Quarterly', 'HalfYearly'] as InstallmentFrequencyKind[]).map(
            (kind) => {
              const match = lookup.get(kind)
              if (match)
                return {
                  kind,
                  active: true,
                  locked: match.locked,
                  valuePerPeriod: match.amount,
                }
              return { kind, active: false, locked: false, valuePerPeriod: 0 }
            },
          ),
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit])

  function setInstallment<K extends keyof InstallmentInput>(
    kind: InstallmentFrequencyKind,
    field: K,
    value: InstallmentInput[K],
  ) {
    setInstallments((arr) =>
      arr.map((f) => (f.kind === kind ? { ...f, [field]: value } : f)),
    )
  }

  function toggleFrequencyActive(kind: InstallmentFrequencyKind) {
    setInstallments((arr) => {
      const next = arr.map((f) =>
        f.kind === kind ? { ...f, active: !f.active } : f,
      )
      // Enforce "≥1 active" but only across admin-available kinds.
      const activeAdminAvailable = next.filter(
        (f) => f.active && adminAvailableFrequencies.includes(f.kind),
      )
      if (adminAvailableFrequencies.length > 0 && activeAdminAvailable.length === 0)
        return arr
      return next
    })
  }

  // ── Milestone head toggling (with min-2-grey + min-2-finishing rules) ───
  function toggleHead(name: string, category: PaymentHeadCategory) {
    setBuyerEnabledHeadNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        // Enforce minimums before allowing deselection.
        const isGrey = category === 'Grey Structure'
        const isFin = category === 'Finishing'
        if (isGrey || isFin) {
          const currentCount = adminEnabledHeads.filter(
            (h) => h.category === category && next.has(h.name),
          ).length
          if (currentCount <= 2) return prev
        }
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // ── Build the effective head list (admin × buyer toggles) ──────────────
  const effectiveHeads: PaymentHead[] = useMemo(
    () =>
      adminEnabledHeads.map((h) => ({
        ...h,
        enabled: buyerEnabledHeadNames.has(h.name),
      })),
    [adminEnabledHeads, buyerEnabledHeadNames],
  )

  // ── Compute plan ────────────────────────────────────────────────────────
  const plan: PlanResult = useMemo(() => {
    const input: ComputeInput = {
      unitPrice,
      loanIncluded,
      loanAmount: unitLoanAmount,
      totalDurationMonths: totalDuration,
      downPaymentPct,
      possessionPct: effectivePossessionPct,
      installments: installmentsForEngine,
      heads: effectiveHeads,
    }
    return computePlan(input)
  }, [
    unitPrice,
    loanIncluded,
    unitLoanAmount,
    totalDuration,
    downPaymentPct,
    effectivePossessionPct,
    installmentsForEngine,
    effectiveHeads,
  ])

  const [pdfOpen, setPdfOpen] = useState(false)

  if (!enabled) return null
  if (!unitPrice || unitPrice <= 0) {
    return (
      <section className="bg-ivory py-16 md:py-20">
        <div className="container max-w-3xl">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
            {sectionNumber}
          </span>
          <h2 className="mt-5 font-serif text-3xl leading-tight tracking-tight text-brand-deep md:text-4xl">
            Payment plan coming soon.
          </h2>
          <p className="mt-4 text-brand-deep/70">
            Configuration is being finalised for this project. Speak to an advisor for current
            availability.
          </p>
        </div>
      </section>
    )
  }

  const adminGreyCount = adminEnabledHeads.filter((h) => h.category === 'Grey Structure').length
  const adminFinishingCount = adminEnabledHeads.filter((h) => h.category === 'Finishing').length

  return (
    <section id="payment-plan" className="bg-ivory py-20 md:py-28">
      <div className="container">
        <div className="mb-12 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              {sectionNumber}
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl">
            Customise your payment plan.
          </h2>
          <SectionRule className="mt-6" />
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-brand-deep/70 md:text-lg">
            Pick your unit, adjust the down payment, installments, and milestones — the schedule
            updates live. Download a personalised PDF when you&rsquo;re ready.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          {/* ── Inputs ──────────────────────────────────────── */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-brand-deep/10 bg-white p-6 shadow-luxe-sm md:p-8">
              {/* Unit selector */}
              {unitTypes.length > 0 && (
                <div className="mb-6">
                  <label
                    htmlFor="ppc-unit"
                    className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55"
                  >
                    Unit Type
                  </label>
                  <select
                    id="ppc-unit"
                    value={selectedUnitKey}
                    onChange={(e) => setSelectedUnitKey(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-brand-deep/15 bg-white px-4 py-3 text-base text-brand-deep focus:border-gold focus:outline-none"
                  >
                    {unitTypes.map((u) => {
                      const label = u.name ? `${u.name} — ${u.type}` : u.type
                      return (
                        <option
                          key={`${u.name ?? ''}-${u.type}-${u.rooms}-${u.price}`}
                          value={`${u.type}::${u.rooms}::${u.price}`}
                        >
                          {label} · {formatPkr(u.price)}
                          {u.areaSqFt ? ` · ${u.areaSqFt} sq ft` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              {/* Loan toggle */}
              {unitLoanAmount > 0 && (
                <div className="mb-6 rounded-lg border border-brand-deep/15 bg-cream/40 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={loanIncluded}
                      onChange={(e) => setLoanIncluded(e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-gold"
                    />
                    <span className="flex-1">
                      <span className="block font-serif text-base text-brand-deep">
                        Include Expected Loan?
                      </span>
                      <span className="mt-1 block text-xs text-brand-deep/70">
                        Pre-arranged loan of {formatPkr(unitLoanAmount)} on this unit. When
                        included, the plan calculates against the price after loan.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {/* Unit price + effective price */}
              <div className="mb-6">
                <div className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55">
                  Total Price
                </div>
                <div className="mt-1 font-serif text-3xl tracking-tight text-brand-deep md:text-4xl">
                  {formatPkr(plan.totals.effectivePrice)}
                </div>
                {loanIncluded && unitLoanAmount > 0 && (
                  <div className="mt-1 text-xs text-brand-deep/55">
                    Unit price {formatPkr(unitPrice)} − loan {formatPkr(unitLoanAmount)} ={' '}
                    {formatPkr(plan.totals.effectivePrice)}
                  </div>
                )}
              </div>

              {/* DP */}
              <div className="mb-6">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="ppc-down"
                    className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55"
                  >
                    Down Payment
                  </label>
                  <span className="font-serif text-2xl text-brand-deep">
                    {downPaymentPct}%
                  </span>
                </div>
                <input
                  id="ppc-down"
                  type="range"
                  min={minDown}
                  max={maxDown}
                  step={1}
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-brand-deep/10 accent-gold"
                />
                <div className="mt-2 flex items-baseline justify-between text-xs text-brand-deep/60">
                  <span>Min {minDown}%</span>
                  <span className="font-medium text-brand-deep">
                    {formatPkr(plan.totals.downPayment)}
                  </span>
                  <span>Max {maxDown}%</span>
                </div>
                {plan.resolved.activeInitialHeadNames.length > 0 && (
                  <p className="mt-2 text-[0.65rem] text-brand-deep/55">
                    Split across: {plan.resolved.activeInitialHeadNames.join(', ')}
                  </p>
                )}
              </div>

              {/* Possession — only renders when admin has the Possession head enabled */}
              {possessionAdminEnabled && (
                <div className="mb-6">
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor="ppc-poss"
                      className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55"
                    >
                      Possession
                    </label>
                    <span className="font-serif text-2xl text-brand-deep">
                      {possessionPct}%
                    </span>
                  </div>
                  <input
                    id="ppc-poss"
                    type="range"
                    min={0}
                    max={possessionCap}
                    step={0.5}
                    value={possessionPct}
                    onChange={(e) => setPossessionPct(Number(e.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-brand-deep/10 accent-gold"
                  />
                  <div className="mt-2 flex items-baseline justify-between text-xs text-brand-deep/60">
                    <span>0%</span>
                    <span className="font-medium text-brand-deep">
                      {formatPkr(plan.totals.possession)}
                    </span>
                    <span>{possessionCap}% cap</span>
                  </div>
                </div>
              )}

              {/* Installment frequencies — only renders if admin enabled any */}
              {adminAvailableFrequencies.length > 0 && (
              <div className="mb-6">
                <div className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55">
                  Time-Based Installments
                </div>
                <div className="mt-3 space-y-2">
                  {installments.filter((f) => adminAvailableFrequencies.includes(f.kind)).map((f) => {
                    const resolved = plan.resolved.installments.find(
                      (r) => r.kind === f.kind,
                    )
                    const periodCount = plan.cadence.periodCount[f.kind]
                    return (
                      <div
                        key={f.kind}
                        className="rounded-lg border border-brand-deep/15 bg-white p-3"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={f.active}
                            onChange={() => toggleFrequencyActive(f.kind)}
                            className="h-4 w-4 cursor-pointer accent-gold"
                            aria-label={`Activate ${FREQUENCY_LABEL[f.kind]}`}
                          />
                          <span className="flex-1 text-sm font-medium text-brand-deep">
                            {FREQUENCY_LABEL[f.kind]}
                          </span>
                          {f.active && (
                            <button
                              type="button"
                              onClick={() =>
                                setInstallment(f.kind, 'locked', !f.locked)
                              }
                              className="rounded-md p-1 text-brand-deep/60 hover:text-gold"
                              aria-label={f.locked ? 'Unlock' : 'Lock'}
                              title={f.locked ? 'Unlock (auto-compute)' : 'Lock (fix value)'}
                            >
                              {f.locked ? (
                                <Lock className="h-3.5 w-3.5" />
                              ) : (
                                <Unlock className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        {f.active && (
                          <div className="mt-2 flex items-baseline gap-3">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={
                                f.locked
                                  ? f.valuePerPeriod
                                  : Math.round(resolved?.valuePerPeriod ?? 0)
                              }
                              onChange={(e) =>
                                setInstallment(
                                  f.kind,
                                  'valuePerPeriod',
                                  Number(e.target.value),
                                )
                              }
                              readOnly={!f.locked}
                              className={cn(
                                'w-full rounded-md border px-3 py-2 text-sm',
                                f.locked
                                  ? 'border-brand-deep/30 bg-white text-brand-deep'
                                  : 'border-brand-deep/10 bg-cream/40 text-brand-deep/70',
                              )}
                              placeholder="PKR per period"
                            />
                            <span className="text-[0.65rem] uppercase tracking-wider text-brand-deep/55">
                              × {periodCount}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="mt-2 text-[0.65rem] text-brand-deep/55">
                  At least one frequency must remain active. Lock 🔒 to fix a value; unlocked
                  installments share the time-based budget equally.
                </p>
              </div>
              )}

              {/* Milestone heads — only renders if admin enabled any milestone heads */}
              {(adminGreyCount + adminFinishingCount) > 0 && (
              <div className="mb-2">
                <div className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55">
                  Active Milestones
                </div>
                <p className="mt-2 text-[0.7rem] text-brand-deep/55">
                  Toggle any milestone off; the schedule rebalances.
                  {adminGreyCount >= 2 && adminFinishingCount >= 2
                    ? ' Minimum 2 early-stage + 2 late-stage milestones required.'
                    : adminGreyCount >= 2
                      ? ' Minimum 2 early-stage milestones required.'
                      : adminFinishingCount >= 2
                        ? ' Minimum 2 late-stage milestones required.'
                        : ''}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {adminEnabledHeads
                    .filter(
                      (h) =>
                        h.category === 'Grey Structure' || h.category === 'Finishing',
                    )
                    .map((h) => {
                      const checked = buyerEnabledHeadNames.has(h.name)
                      const minCount =
                        h.category === 'Grey Structure' ? adminGreyCount : adminFinishingCount
                      const activeCount = adminEnabledHeads.filter(
                        (x) =>
                          x.category === h.category && buyerEnabledHeadNames.has(x.name),
                      ).length
                      const cannotDeselect = checked && activeCount <= 2
                      return (
                        <label
                          key={h.name}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                            checked ? 'bg-gold/10 text-brand-deep' : 'bg-cream/40 text-brand-deep/55',
                            cannotDeselect && 'cursor-not-allowed opacity-90',
                          )}
                          title={
                            cannotDeselect
                              ? `Minimum 2 ${h.category === 'Grey Structure' ? 'early-stage' : 'late-stage'} milestones required`
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={cannotDeselect}
                            onChange={() => toggleHead(h.name, h.category)}
                            className="h-3.5 w-3.5 accent-gold disabled:opacity-50"
                          />
                          <span className="flex-1 truncate">{h.name}</span>
                          {minCount < 2 && (
                            <span className="text-[0.6rem] text-red-600">!</span>
                          )}
                        </label>
                      )
                    })}
                </div>
              </div>
              )}
            </div>
          </div>

          {/* ── Output table ─────────────────────────────── */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-brand-deep/10 bg-white p-6 shadow-luxe-sm md:p-8">
              {plan.warnings.length > 0 && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <ul className="list-disc pl-4 space-y-1">
                    {plan.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-brand-deep/10 text-left">
                      <th className="py-3 pr-4 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-brand-deep/55">
                        When
                      </th>
                      <th className="py-3 pr-4 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-brand-deep/55">
                        Head
                      </th>
                      <th className="py-3 pr-4 text-right font-mono text-[0.6rem] uppercase tracking-[0.25em] text-brand-deep/55">
                        Amount
                      </th>
                      <th className="py-3 text-right font-mono text-[0.6rem] uppercase tracking-[0.25em] text-brand-deep/55">
                        Cumulative
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-b border-brand-deep/5 last:border-b-0',
                          row.kind === 'down-payment' && 'bg-gold/5',
                          row.kind === 'possession' && 'bg-brand-deep/5',
                        )}
                      >
                        <td className="py-3 pr-4 text-brand-deep/80 whitespace-nowrap">{row.label}</td>
                        <td className="py-3 pr-4 text-brand-deep">{row.headName}</td>
                        <td className="py-3 pr-4 text-right font-medium text-brand-deep whitespace-nowrap">
                          {formatPkr(row.amount)}
                        </td>
                        <td className="py-3 text-right text-brand-deep/70 whitespace-nowrap">
                          {row.cumulativePct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-brand-deep/20">
                      <td className="py-4 pr-4 font-serif text-base text-brand-deep" colSpan={2}>
                        Total
                      </td>
                      <td className="py-4 pr-4 text-right font-serif text-base text-brand-deep">
                        {formatPkr(plan.totals.effectivePrice)}
                      </td>
                      <td className="py-4 text-right font-serif text-base text-brand-deep">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <ul className="mt-6 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <RuleBadge
                  ok={possessionPct <= 5}
                  text={`Possession ≤ 5% (now ${possessionPct}%)`}
                />
                {adminGreyCount > 0 && (
                  <RuleBadge
                    ok={plan.resolved.activeGreyHeadNames.length >= 2}
                    text={`${plan.resolved.activeGreyHeadNames.length} early-stage active`}
                  />
                )}
                {adminFinishingCount > 0 && (
                  <RuleBadge
                    ok={plan.resolved.activeFinishingHeadNames.length >= 2}
                    text={`${plan.resolved.activeFinishingHeadNames.length} late-stage active`}
                  />
                )}
              </ul>

              <button
                type="button"
                onClick={() => setPdfOpen(true)}
                disabled={plan.warnings.length > 0}
                className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileDown className="h-4 w-4" />
                Download PDF Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      <PaymentPlanPdfModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        project={project}
        downPaymentPct={downPaymentPct}
        possessionPct={effectivePossessionPct}
        loanIncluded={loanIncluded}
        installments={installmentsForEngine}
        buyerEnabledHeadNames={Array.from(buyerEnabledHeadNames)}
        selectedUnitType={selectedUnit?.type ?? null}
        selectedUnitName={selectedUnit?.name ?? null}
        totalPrice={plan.totals.effectivePrice}
      />
    </section>
  )
}

function RuleBadge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2',
        ok ? 'bg-gold/10 text-brand-deep' : 'bg-red-50 text-red-700',
      )}
    >
      <Check className={cn('h-3.5 w-3.5 shrink-0', ok ? 'text-gold' : 'text-red-500')} />
      <span>{text}</span>
    </li>
  )
}
