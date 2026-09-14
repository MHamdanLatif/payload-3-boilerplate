import { computePlan, type PlanResult, type PlanRow, type PlanRowKind } from './payment-plan'
import { DEFAULT_PAYMENT_HEADS, type PaymentHead } from './payment-heads'
import type { FeaturedProject } from '@/payload-types'

export type StudioProject = Pick<
  FeaturedProject,
  'id' | 'title' | 'slug' | 'unitTypes' | 'paymentPlan'
>

export type Charge = { id: string; name: string; amount: number; separate: boolean; month: number }
export type Discount = { id: string; name: string; amount: number }
export type AdminHead = {
  id: string
  name: string
  kind: 'down-payment' | 'installment' | 'milestone' | 'possession'
  amount: number
  method: 'entered' | 'calculated'
  count: number
  firstMonth: number
  intervalMonths: number
}
export type AdminPlanInput = {
  projectId: number
  unitId: string
  basePrice: number
  duration: number
  charges: Charge[]
  discounts: Discount[]
  heads: AdminHead[]
}
export type AdminPlanResult = {
  plan: PlanResult
  finalPrice: number
  regularPrice: number
  allocated: number
  remaining: number
  breakdown: { label: string; amount: number }[]
}
const cents = (n: number) => Math.round(n * 100)
const amountOK = (n: unknown): n is number =>
  typeof n === 'number' &&
  Number.isFinite(n) &&
  n >= 0 &&
  n <= 1e12 &&
  Math.abs(n * 100 - Math.round(n * 100)) < 0.02
const textOK = (s: unknown): s is string =>
  typeof s === 'string' && s.trim().length > 0 && s.length <= 120
const monthOK = (n: unknown): n is number =>
  Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 240

/** Shared by the browser and authenticated export. Never trust client totals. */
export function validateAdminPlan(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return ['Expected a payment plan.']
  const p = value as AdminPlanInput
  const errors: string[] = []
  if (!Number.isInteger(p.projectId) || !textOK(p.unitId)) errors.push('Select a project and unit.')
  if (!amountOK(p.basePrice) || p.basePrice <= 0)
    errors.push('Base price must be positive, with at most two decimal places.')
  if (!Number.isInteger(p.duration) || p.duration < 1 || p.duration > 120)
    errors.push('Duration must be between 1 and 120 whole months.')
  if (
    !Array.isArray(p.charges) ||
    p.charges.length > 50 ||
    p.charges.some(
      (c) =>
        !c ||
        !textOK(c.id) ||
        !textOK(c.name) ||
        !amountOK(c.amount) ||
        typeof c.separate !== 'boolean' ||
        !monthOK(c.month),
    )
  )
    errors.push('Check charge names, amounts and due months (0–240).')
  if (
    !Array.isArray(p.discounts) ||
    p.discounts.length > 50 ||
    p.discounts.some((d) => !d || !textOK(d.id) || !textOK(d.name) || !amountOK(d.amount))
  )
    errors.push('Check discount names and amounts.')
  if (
    !Array.isArray(p.heads) ||
    !p.heads.length ||
    p.heads.length > 100 ||
    p.heads.some(
      (h) =>
        !h ||
        !textOK(h.id) ||
        !textOK(h.name) ||
        !['down-payment', 'installment', 'milestone', 'possession'].includes(h.kind) ||
        !['entered', 'calculated'].includes(h.method) ||
        !amountOK(h.amount) ||
        !Number.isInteger(h.count) ||
        h.count < 1 ||
        h.count > 120 ||
        !monthOK(h.firstMonth) ||
        !monthOK(h.intervalMonths) ||
        (h.count > 1 && h.intervalMonths < 1) ||
        h.firstMonth + (h.count - 1) * h.intervalMonths > 240,
    )
  )
    errors.push('Check payment heads, amounts, counts and timing (up to month 240).')
  if (!errors.length) {
    const ids = [...p.heads, ...p.charges, ...p.discounts].map((x) => x.id)
    if (new Set(ids).size !== ids.length)
      errors.push('Each payment and adjustment must have a unique identity.')
    if (p.heads.reduce((s, h) => s + h.count, 0) + p.charges.length > 1000)
      errors.push('Limit the schedule to 1,000 payments.')
  }
  return errors
}

export function computeAdminPlan(input: AdminPlanInput): AdminPlanResult {
  const invalid = validateAdminPlan(input)
  if (invalid.length) throw new Error(invalid.join(' '))
  const extra = input.charges.reduce((s, c) => s + cents(c.amount), 0)
  const discount = input.discounts.reduce((s, d) => s + cents(d.amount), 0)
  const final = cents(input.basePrice) + extra - discount
  const separate = input.charges.filter((c) => c.separate).reduce((s, c) => s + cents(c.amount), 0)
  const regular = final - separate
  const entered = input.heads
    .filter((h) => h.method === 'entered')
    .reduce((s, h) => s + cents(h.amount) * h.count, 0)
  const autoCount = input.heads
    .filter((h) => h.method === 'calculated')
    .reduce((s, h) => s + h.count, 0)
  const available = regular - entered
  const warnings: string[] = []
  if (final <= 0 || regular < 0 || final > 1e12 * 100)
    warnings.push(
      'Discounts must leave a positive total and a non-negative regular schedule price.',
    )
  if (available < 0)
    warnings.push(
      'Entered payments exceed the regular schedule price. Reduce a payment or adjust the price.',
    )
  const perEvent = autoCount ? Math.floor(Math.max(0, available) / autoCount) : 0
  let tail = autoCount ? Math.max(0, available) - perEvent * autoCount : 0
  const rows: PlanRow[] = []
  for (const head of input.heads) {
    for (let i = 0; i < head.count; i++) {
      const month = head.firstMonth + i * head.intervalMonths
      const value = head.method === 'entered' ? cents(head.amount) : perEvent + (tail-- > 0 ? 1 : 0)
      const kind: PlanRowKind =
        head.kind === 'installment'
          ? head.intervalMonths === 3
            ? 'installment-quarterly'
            : head.intervalMonths === 6
              ? 'installment-halfyearly'
              : 'installment-monthly'
          : head.kind
      rows.push({
        sourceId: head.id,
        kind,
        headName: head.name,
        label:
          head.kind === 'milestone' && month === 0
            ? 'On completion'
            : month === 0
              ? 'At signing'
              : `Month ${month}`,
        monthOffset: head.kind === 'milestone' && month === 0 ? input.duration + 0.5 : month,
        amount: value / 100,
        cumulativeAmount: 0,
        cumulativePct: 0,
      })
    }
  }
  for (const charge of input.charges.filter((c) => c.separate))
    rows.push({
      kind: 'extra-charge',
      headName: charge.name,
      label: charge.month === 0 ? 'At signing' : `Month ${charge.month}`,
      monthOffset: charge.month,
      amount: charge.amount,
      cumulativeAmount: 0,
      cumulativePct: 0,
    })
  rows.sort((a, b) => a.monthOffset - b.monthOffset)
  let running = 0
  rows.forEach((r) => {
    running += cents(r.amount)
    r.cumulativeAmount = running / 100
    r.cumulativePct = final > 0 ? Math.round((running / final) * 10000) / 100 : 0
  })
  const remaining = (final - running) / 100
  if (Math.abs(remaining) > 0.005)
    warnings.push(
      `Allocate the remaining PKR ${remaining.toLocaleString('en-PK')} before exporting.`,
    )
  const sum = (kind: string) =>
    rows.filter((r) => r.kind.startsWith(kind)).reduce((s, r) => s + cents(r.amount), 0) / 100
  const plan: PlanResult = {
    rows,
    warnings,
    totals: {
      unitPrice: input.basePrice,
      effectivePrice: final / 100,
      loanAmount: 0,
      downPayment: sum('down-payment'),
      installmentTotal: sum('installment-'),
      milestoneTotal: sum('milestone'),
      possession: sum('possession'),
      greyTotal: 0,
      finishingTotal: 0,
    },
    cadence: {
      monthsPerPeriod: { Monthly: 1, Quarterly: 3, HalfYearly: 6 },
      periodCount: { Monthly: 0, Quarterly: 0, HalfYearly: 0 },
      activeFrequencies: [],
    },
    resolved: {
      installments: [],
      activeGreyHeadNames: [],
      activeFinishingHeadNames: [],
      activeInitialHeadNames: [],
    },
  }
  return {
    plan,
    finalPrice: final / 100,
    regularPrice: regular / 100,
    allocated: running / 100,
    remaining,
    breakdown: [
      { label: 'Base unit price', amount: input.basePrice },
      ...input.charges.map((c) => ({
        label: `${c.name}${c.separate ? ` (separate payment, month ${c.month})` : ' (in regular schedule)'}`,
        amount: c.amount,
      })),
      ...input.discounts.map((d) => ({ label: d.name, amount: -d.amount })),
      { label: 'Final payable price', amount: final / 100 },
    ],
  }
}

export function initialAdminPlan(project: StudioProject, unitId: string): AdminPlanInput {
  const unit = project.unitTypes?.find((u) => u.id === unitId)
  if (!unit) throw new Error('Select a valid unit.')
  const config = project.paymentPlan
  const heads = (
    config?.paymentHeads?.length ? config.paymentHeads : DEFAULT_PAYMENT_HEADS
  ) as PaymentHead[]
  const defaults = unit.defaultPlan
  const duration = config?.totalDurationMonths ?? 36
  const plan = computePlan({
    unitPrice: config?.priceOverride ?? unit.price,
    loanIncluded: false,
    loanAmount: 0,
    totalDurationMonths: duration,
    downPaymentPct:
      defaults?.downPaymentPct ??
      Math.min(config?.downPaymentMaxPct ?? 30, Math.max(config?.downPaymentMinPct ?? 10, 20)),
    possessionPct: heads.some((h) => h.enabled && h.category === 'Possession')
      ? (defaults?.possessionPct ?? config?.possessionPct ?? 5)
      : 0,
    heads,
    installments: (['Monthly', 'Quarterly', 'HalfYearly'] as const).map((kind, index) => {
      const row = defaults?.installments?.find((r) => r.frequency === kind)
      const name =
        kind === 'Monthly'
          ? 'Monthly Installments'
          : kind === 'Quarterly'
            ? 'Quarterly Installments'
            : 'Half Yearly Installments'
      const enabled = heads.some((h) => h.enabled && h.name === name)
      return {
        kind,
        active:
          enabled &&
          (defaults?.installments?.length
            ? Boolean(row)
            : index === 0 || !heads.some((h) => h.enabled && h.name === 'Monthly Installments')),
        locked: row?.locked !== false && Boolean(row),
        valuePerPeriod: row?.amount ?? 0,
      }
    }),
  })
  const result: AdminHead[] = []
  for (const row of plan.rows) {
    const installment = row.kind.startsWith('installment-')
    const existing = installment ? result.find((h) => h.name === row.headName) : undefined
    if (existing) {
      existing.count++
      continue
    }
    result.push({
      id: `head-${result.length}`,
      name: row.headName,
      kind: installment ? 'installment' : (row.kind as AdminHead['kind']),
      amount: row.amount,
      method: 'entered',
      count: 1,
      firstMonth: row.kind === 'milestone' ? 0 : Math.floor(row.monthOffset),
      intervalMonths: installment
        ? row.kind === 'installment-quarterly'
          ? 3
          : row.kind === 'installment-halfyearly'
            ? 6
            : 1
        : 0,
    })
  }
  // One clearly identified payment receives any remainder; other defaults stay intact.
  const absorber =
    result.find((h) => h.kind === 'installment') ?? result.find((h) => h.kind === 'milestone')
  if (absorber) absorber.method = 'calculated'
  return {
    projectId: project.id,
    unitId,
    basePrice: config?.priceOverride ?? unit.price,
    duration,
    charges: [],
    discounts: [],
    heads: result,
  }
}
