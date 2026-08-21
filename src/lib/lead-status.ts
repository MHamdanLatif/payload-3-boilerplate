/**
 * The lead pipeline: one definition, used by the collection, the dashboard and
 * the CSV export.
 *
 * Previously the dashboard and the export each printed the raw database value,
 * so a rename in one place silently disagreed with the other. Labels live here.
 *
 * A note on `unqualified`: its LABEL is "Uncontacted". It is the default a lead
 * is created with, and historically it meant "nobody has touched this yet" -
 * which is exactly what Uncontacted means. The database value is deliberately
 * left alone rather than migrated: relabelling is free and reversible, whereas
 * rewriting 56 live rows would be a guess about what each one meant. "Real
 * person, does not fit" is now the separate `not-a-fit` status.
 */

export const LEAD_STATUSES = [
  'unqualified',
  'details-sent',
  'engaged',
  'contacted',
  'qualified',
  'site-visit',
  'negotiation',
  'booking-pending',
  'closed-won',
  'unresponsive',
  'nurture',
  'not-a-fit',
  'lost',
  'junk',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const STATUS_LABELS: Record<LeadStatus, string> = {
  unqualified: 'Uncontacted',
  'details-sent': 'Details Sent',
  engaged: 'Engaged',
  contacted: 'Contacted',
  qualified: 'Qualified',
  'site-visit': 'Site Visit',
  negotiation: 'Negotiation',
  'booking-pending': 'Booking Pending',
  'closed-won': 'Closed Won',
  unresponsive: 'Unresponsive',
  nurture: 'Nurture',
  'not-a-fit': 'Not a Fit',
  lost: 'Lost',
  junk: 'Invalid / Junk',
}

export const statusLabel = (s: string | null | undefined): string =>
  (s && STATUS_LABELS[s as LeadStatus]) || 'Uncontacted'

/**
 * Stages a lead passes THROUGH, in order.
 *
 * The terminal outcomes are excluded on purpose. Counting must be cumulative:
 * a lead at "Closed Won" has self-evidently been qualified, so a strict
 * `status === 'qualified'` test would shrink the qualified count every time a
 * deal progressed.
 */
export const FUNNEL: readonly LeadStatus[] = [
  'details-sent',
  'engaged',
  'contacted',
  'qualified',
  'site-visit',
  'negotiation',
  'booking-pending',
  'closed-won',
]

/** Outcomes that end a journey rather than advancing it. */
export const TERMINAL_STATUSES: readonly LeadStatus[] = [
  'unresponsive',
  'nurture',
  'not-a-fit',
  'lost',
  'junk',
]

/** Has this lead reached `stage` or beyond? */
export const atLeast = (status: string | null | undefined, stage: LeadStatus): boolean => {
  const i = FUNNEL.indexOf((status ?? '') as LeadStatus)
  return i >= 0 && i >= FUNNEL.indexOf(stage)
}

/** Did anyone actually speak to this lead, whatever the outcome? */
export const wasWorked = (status: string | null | undefined): boolean =>
  atLeast(status, 'details-sent') || TERMINAL_STATUSES.includes((status ?? '') as LeadStatus)

/** Statuses where a reason for not proceeding is worth recording. */
export const NEEDS_REASON: readonly LeadStatus[] = ['not-a-fit', 'lost', 'junk', 'unresponsive']

export const statusOptions = LEAD_STATUSES.map((value) => ({
  label: STATUS_LABELS[value],
  value,
}))
