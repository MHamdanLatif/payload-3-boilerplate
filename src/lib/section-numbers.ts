import { sortedUnits, unitSummary } from '@/lib/featured-projects'
import type { TrackRecordSource, UnitsTableSource } from '@/lib/project-shape'

/**
 * Page sections are numbered in the order they actually appear ("01 / GALLERY",
 * "02 / AMENITIES" ...). Sections hide themselves when the CMS has nothing for
 * them, so fixed numbers left gaps: a project without a gallery read 02, 03, 04.
 *
 * Pages list their sections in render order with a `show` flag, and only the
 * visible ones are numbered. The `has*` checks below are the same ones the
 * section components use to render nothing, so the two cannot disagree.
 */
export function numberSections<K extends string>(
  sections: readonly { key: K; label: string; show: boolean }[],
  first = 1,
): Record<K, string> {
  const labels = {} as Record<K, string>
  let n = first
  for (const s of sections)
    labels[s.key] = s.show ? `${String(n++).padStart(2, '0')} / ${s.label}` : ''
  return labels
}

export const hasGallery = (photos: { image?: unknown }[] | null | undefined) =>
  (photos ?? []).some((r) => !!r?.image)

export const hasAmenities = (amenities: unknown[] | null | undefined) => !!amenities?.length

export const hasMap = (embedUrl: string | null | undefined) => !!embedUrl

export const hasFaqs = (faqs: { question?: string | null; answer?: string | null }[] | null | undefined) =>
  (faqs ?? []).some((f) => f?.question && f?.answer)

/** A single entry is not a progression, so the block needs at least two. */
export const hasTrackRecord = (project: TrackRecordSource) =>
  (project.builderTrackRecord ?? []).length >= 2

export const hasUnitsTable = (project: UnitsTableSource) =>
  sortedUnits(project).length > 0 && !!unitSummary(project)
