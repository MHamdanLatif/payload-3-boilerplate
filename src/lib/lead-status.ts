/**
 * The lead pipeline: one definition, used by the collection, the dashboard and
 * the CSV export.
 *
 *   New → Contacted → Brochure Not Opened / Engaged → Qualified → Site Visited
 *     → Closed Won, with Not a Fit and Invalid / Junk as outcomes.
 *
 * Database values predate the current labels and are kept rather than renamed:
 * `unqualified` is New (the default every lead is created with), `details-sent`
 * is Brochure Not Opened (set when the brochure is sent) and `engaged` is set
 * when the lead opens it. Relabelling is free; renaming values would mean a
 * schema change on every environment for no behavioural gain.
 */

export const LEAD_STATUSES = [
  'unqualified',
  'contacted',
  'details-sent',
  'engaged',
  'qualified',
  'site-visit',
  'closed-won',
  'not-a-fit',
  'junk',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const STATUS_LABELS: Record<LeadStatus, string> = {
  unqualified: 'New',
  contacted: 'Contacted',
  'details-sent': 'Brochure Not Opened',
  engaged: 'Engaged',
  qualified: 'Qualified',
  'site-visit': 'Site Visited',
  'closed-won': 'Closed Won',
  'not-a-fit': 'Not a Fit',
  junk: 'Invalid / Junk',
}

export const statusLabel = (s: string | null | undefined): string =>
  (s && STATUS_LABELS[s as LeadStatus]) || 'New'

/**
 * Stages a lead passes THROUGH, in order.
 *
 * The terminal outcomes are excluded on purpose. Counting must be cumulative:
 * a lead at "Closed Won" has self-evidently been qualified, so a strict
 * `status === 'qualified'` test would shrink the qualified count every time a
 * deal progressed.
 */
export const FUNNEL: readonly LeadStatus[] = [
  'contacted',
  'details-sent',
  'engaged',
  'qualified',
  'site-visit',
  'closed-won',
]

/** Outcomes that end a journey rather than advancing it. */
export const TERMINAL_STATUSES: readonly LeadStatus[] = ['not-a-fit', 'junk']

/** Has this lead reached `stage` or beyond? */
export const atLeast = (status: string | null | undefined, stage: LeadStatus): boolean => {
  const i = FUNNEL.indexOf((status ?? '') as LeadStatus)
  return i >= 0 && i >= FUNNEL.indexOf(stage)
}

/**
 * Statuses Meta is told mean a good lead. Site Visited and Closed Won are
 * qualified leads that went further; Meta hears about the lead once.
 */
export const isQualifiedLead = (status: string | null | undefined): boolean =>
  atLeast(status, 'qualified')

export const statusOptions = LEAD_STATUSES.map((value) => ({
  label: STATUS_LABELS[value],
  value,
}))
