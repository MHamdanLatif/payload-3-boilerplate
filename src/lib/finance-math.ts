// Pure finance arithmetic shared by the server (posting, validation, reports) and the
// browser (live previews). No imports, so unit tests and client components can load it.
//
// Money is handled as integer paisa and percentages as integer units of 0.0001%, so
// every allocation is exact and reconciles to the amount it splits. Rounding uses the
// largest-remainder method with ties broken by line order, which is deterministic.

export const PCT_SCALE = 10_000
export const FULL_SPLIT = 100 * PCT_SCALE
const MAX_PAISA = 999_999_999_999 * 100

/** PKR amount (up to two decimals) to integer paisa. Throws on anything else. */
export function toPaisa(value: unknown): number {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value)
  if (value === '' || value == null || !Number.isFinite(n)) throw new Error('Enter an amount.')
  const p = Math.round(n * 100)
  if (Math.abs(n * 100 - p) > 0.001) throw new Error('Amounts can have at most two decimals.')
  if (Math.abs(p) > MAX_PAISA) throw new Error('Amount is too large.')
  return p
}
export const fromPaisa = (p: number) => p / 100

/** Percentage (up to four decimals) to integer units. */
export function toPctUnits(value: unknown): number {
  const n = Number(value)
  if (value === '' || value == null || !Number.isFinite(n)) throw new Error('Enter a percentage.')
  const u = Math.round(n * PCT_SCALE)
  if (Math.abs(n * PCT_SCALE - u) > 0.001)
    throw new Error('Percentages can have at most four decimals.')
  if (u < 0 || u > FULL_SPLIT) throw new Error('Each percentage must be between 0 and 100.')
  return u
}

/**
 * Split `total` paisa across `weights` exactly. Negative totals are split the same way
 * and negated, so a negative bank-charge difference is apportioned symmetrically.
 */
export function apportion(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total)) throw new Error('Allocation total must be whole paisa.')
  if (!weights.length) throw new Error('Nothing to allocate to.')
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0))
    throw new Error('Allocation weights must be whole, non-negative numbers.')
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) throw new Error('Allocation weights must total more than zero.')
  const sign = total < 0 ? -1n : 1n
  const abs = BigInt(Math.abs(total))
  const big = BigInt(sum)
  const base = weights.map((w) => (abs * BigInt(w)) / big)
  const rest = weights.map((w) => (abs * BigInt(w)) % big)
  let left = abs - base.reduce((a, b) => a + b, 0n)
  const order = weights
    .map((_, i) => i)
    .sort((a, b) => (rest[b] > rest[a] ? 1 : rest[b] < rest[a] ? -1 : a - b))
  for (const i of order) {
    if (left <= 0n) break
    base[i] += 1n
    left -= 1n
  }
  return base.map((b) => Number(b * sign))
}

export type SplitLine = { key: string; label: string; pct: number | string }
export type CheckedSplit = { key: string; label: string; units: number }[]

/** Validate a percentage table: named, unique recipients that total exactly 100%. */
export function checkSplit(lines: SplitLine[], what = 'Split'): CheckedSplit {
  if (!lines.length) throw new Error(`${what}: add at least one person.`)
  const seen = new Set<string>()
  const out = lines.map((l, i) => {
    if (!l.key || !String(l.label || '').trim())
      throw new Error(`${what}: line ${i + 1} needs a person.`)
    if (seen.has(l.key)) throw new Error(`${what}: ${l.label} appears more than once.`)
    seen.add(l.key)
    return { key: l.key, label: String(l.label).trim(), units: toPctUnits(l.pct) }
  })
  const total = out.reduce((a, l) => a + l.units, 0)
  if (total !== FULL_SPLIT)
    throw new Error(`${what} must total 100%. It totals ${total / PCT_SCALE}%.`)
  return out
}

export type ChargeLineInput = { key: string; metaPaisa: number }
export type ChargeAllocation = {
  debitPaisa: number
  metaPaisa: number
  additionalPaisa: number
  lines: { key: string; metaPaisa: number; additionalPaisa: number; totalPaisa: number }[]
  flags: string[]
}

/**
 * One bank debit across its Meta amounts. The difference between the debit and the
 * entered Meta amounts ("additional bank charges/taxes") is apportioned by Meta amount.
 */
export function allocateCharge(debitPaisa: number, lines: ChargeLineInput[]): ChargeAllocation {
  if (!Number.isSafeInteger(debitPaisa) || debitPaisa <= 0)
    throw new Error('Enter the actual bank debit.')
  if (!lines.length) throw new Error('Add at least one campaign line.')
  if (lines.some((l) => !Number.isSafeInteger(l.metaPaisa) || l.metaPaisa < 0))
    throw new Error('Meta amounts cannot be negative.')
  const metaPaisa = lines.reduce((a, l) => a + l.metaPaisa, 0)
  if (metaPaisa <= 0) throw new Error('The Meta amounts total zero. Enter the amount per campaign.')
  const additionalPaisa = debitPaisa - metaPaisa
  const extras = apportion(
    additionalPaisa,
    lines.map((l) => l.metaPaisa),
  )
  const flags: string[] = []
  if (additionalPaisa < 0)
    flags.push(
      'The bank debit is less than the Meta amounts entered. Check the amounts before relying on this charge.',
    )
  return {
    debitPaisa,
    metaPaisa,
    additionalPaisa,
    lines: lines.map((l, i) => ({
      key: l.key,
      metaPaisa: l.metaPaisa,
      additionalPaisa: extras[i],
      totalPaisa: l.metaPaisa + extras[i],
    })),
    flags,
  }
}

/** A project cost split by that project's funding percentages. */
export function allocateToParticipants(costPaisa: number, split: CheckedSplit) {
  const amounts = apportion(
    costPaisa,
    split.map((s) => s.units),
  )
  return split.map((s, i) => ({ ...s, paisa: amounts[i] }))
}

export type FundingInput = {
  key: string
  label: string
  receivedPaisa: number
  costPaisa: number
  refundPaisa: number
  adjustmentPaisa: number
}

/**
 * Per-project funding position. Balances never borrow from other participants: someone
 * whose share of costs exceeds their contributions goes negative (a shortfall to top
 * up), while positive balances are only "backed" up to the project's actual pooled cash.
 */
export function fundingPosition(rows: FundingInput[], openingCashPaisa = 0) {
  const participants = rows.map((r) => ({
    ...r,
    balancePaisa: r.receivedPaisa - r.costPaisa - r.refundPaisa + r.adjustmentPaisa,
  }))
  const poolPaisa =
    openingCashPaisa +
    rows.reduce((a, r) => a + r.receivedPaisa - r.costPaisa - r.refundPaisa, 0)
  const positives = participants.map((p) => Math.max(p.balancePaisa, 0))
  const positivePaisa = positives.reduce((a, b) => a + b, 0)
  const shortfallPaisa = participants.reduce((a, p) => a + Math.max(-p.balancePaisa, 0), 0)
  const backedPaisa = Math.min(Math.max(poolPaisa, 0), positivePaisa)
  const backed = positivePaisa > 0 ? apportion(backedPaisa, positives) : positives.map(() => 0)
  const adjustmentPaisa = rows.reduce((a, r) => a + r.adjustmentPaisa, 0)
  return {
    poolPaisa,
    deficitPaisa: Math.max(-poolPaisa, 0),
    positivePaisa,
    backedPaisa,
    unbackedPaisa: positivePaisa - backedPaisa,
    shortfallPaisa,
    adjustmentPaisa,
    participants: participants.map((p, i) => ({
      ...p,
      backedPaisa: backed[i],
      shortfall: p.balancePaisa < 0,
    })),
  }
}

export type CommissionInput = {
  commissionPaisa: number
  receivedPaisa: number
  deductionPaisa: number
  split: CheckedSplit
  paidPaisa: Record<string, number>
}

/**
 * Cumulative commission distribution. Recorded pre-distribution deal deductions are
 * reserved once against everything received so far, never per receipt, so they cannot
 * be applied twice. Advertising spend is never an input here.
 */
export function commissionPosition(c: CommissionInput) {
  const distributablePaisa = Math.max(c.receivedPaisa - c.deductionPaisa, 0)
  const entitlements = c.split.length
    ? apportion(
        distributablePaisa,
        c.split.map((s) => s.units),
      )
    : []
  const recipients = c.split.map((s, i) => {
    const paid = c.paidPaisa[s.key] || 0
    return {
      ...s,
      entitlementPaisa: entitlements[i],
      paidPaisa: paid,
      unpaidPaisa: Math.max(entitlements[i] - paid, 0),
      overpaidPaisa: Math.max(paid - entitlements[i], 0),
    }
  })
  const unknownPaid = Object.entries(c.paidPaisa)
    .filter(([k, v]) => v && !c.split.some((s) => s.key === k))
    .reduce((a, [, v]) => a + v, 0)
  return {
    commissionPaisa: c.commissionPaisa,
    receivedPaisa: c.receivedPaisa,
    outstandingPaisa: Math.max(c.commissionPaisa - c.receivedPaisa, 0),
    deductionPaisa: c.deductionPaisa,
    deductionShortfallPaisa: Math.max(c.deductionPaisa - c.receivedPaisa, 0),
    distributablePaisa,
    recipients,
    paidPaisa: recipients.reduce((a, r) => a + r.paidPaisa, 0) + unknownPaid,
    unpaidPaisa: recipients.reduce((a, r) => a + r.unpaidPaisa, 0),
    overpaidPaisa: recipients.reduce((a, r) => a + r.overpaidPaisa, 0) + unknownPaid,
  }
}
