import type { CollectionBeforeChangeHook } from 'payload'
import type { Blog } from '@/payload-types'
import { countWords, lexicalToPlainText, smartTruncate } from '@/lib/lexical-to-text'

/**
 * Derive sensible defaults for the admin so they don't have to fill every
 * SEO/meta field manually. Only acts on blank values — never overwrites
 * what the admin actually typed.
 *
 *   excerpt           — first ~280 chars of plain content (word-boundary cut)
 *   metaDescription   — first ~160 chars of plain content
 *   readTime          — round(wordCount / 220), minimum 1
 *   publishedAt       — set to now if transitioning to published with no date set
 */
const WORDS_PER_MINUTE = 220

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

export const autoFillBlogDefaults: CollectionBeforeChangeHook<Blog> = ({
  data,
  originalDoc,
}) => {
  if (!data) return data

  const plainText = lexicalToPlainText(data.content)
  const wordCount = countWords(plainText)

  // ── excerpt ────────────────────────────────────────────────
  if (isBlank(data.excerpt) && plainText) {
    data.excerpt = smartTruncate(plainText, 280)
  }

  // ── metaDescription ────────────────────────────────────────
  if (isBlank(data.metaDescription) && plainText) {
    data.metaDescription = smartTruncate(plainText, 160)
  }

  // ── readTime ───────────────────────────────────────────────
  const rt = data.readTime
  if ((rt === null || rt === undefined || rt === 0) && wordCount > 0) {
    data.readTime = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))
  }

  // ── publishedAt ────────────────────────────────────────────
  // Only stamp on the draft → published transition (or first save as published).
  const wasNotPublished = !originalDoc || originalDoc.status !== 'published'
  const isNowPublished = data.status === 'published'
  if (wasNotPublished && isNowPublished && isBlank(data.publishedAt)) {
    data.publishedAt = new Date().toISOString()
  }

  return data
}
