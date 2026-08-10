/**
 * Formatting + UA helpers shared by the leads dashboard and the per-lead
 * activity timeline.
 */

/** Compact, for table cells: "3m 07s" / "42s". Falsy -> em dash. */
export function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

/** Prose, for the timeline: "7m and 15s" / "57s". Falsy -> null. */
export function fmtDurationLong(ms: number | null | undefined): string | null {
  if (!ms) return null
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m and ${s % 60}s`
}

export type Platform = 'Mobile' | 'Tablet' | 'Desktop' | null

/**
 * Coarse device class from the UA string — enough to answer "did they read it
 * on their phone or at a desk", which is all the timeline claims. Tablets are
 * called out separately because an iPad reads much more like desktop use.
 * Unknown/missing UA returns null rather than guessing "Desktop".
 */
export function platformOf(ua: string | null | undefined): Platform {
  if (!ua) return null
  const s = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return 'Tablet'
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini|windows phone/.test(s)) return 'Mobile'
  return 'Desktop'
}
