import type { CollectionBeforeChangeHook, Payload } from 'payload'
import type { Blog } from '@/payload-types'
import { lexicalToPlainText } from '@/lib/lexical-to-text'
import { scanForEntities, type ScannedLink } from '@/lib/entity-scanner'

/**
 * On every Blog save, scan the article body for project + location entity
 * mentions and merge the scanner's findings into `seoInternalLinks`. Runs
 * BEFORE `injectInternalLinks` so the publish-time wrapper has a fully-
 * populated array to act on.
 *
 * Merge rules — admin intent always wins:
 *   • Existing entries (manually added or already-injected) are kept verbatim
 *   • Newly-detected entries are added only if their (kind, anchorText) pair
 *     isn't already present
 *   • Already-injected entries are never re-detected (their `injected: true`
 *     flag is preserved through subsequent saves)
 */

type SeoLinkRow = {
  anchorText: string
  linkType: 'project' | 'location' | 'index'
  targetProject?: number | { id: number } | null
  targetLocationSlug?: string | null
  injected?: boolean | null
  id?: string | null
}

export const populateSeoInternalLinks: CollectionBeforeChangeHook<Blog> = async ({
  data,
  req,
}) => {
  if (!data || !data.content) return data

  const plainText = lexicalToPlainText(data.content)
  if (!plainText) return data

  const scanned = scanForEntities(plainText)
  if (scanned.length === 0) return data

  const existing = (data.seoInternalLinks ?? []) as SeoLinkRow[]
  const existingKeys = new Set(existing.map((row) => keyFor(row)))

  const toAdd: SeoLinkRow[] = []
  for (const link of scanned) {
    const candidateKey = keyFor({
      anchorText: link.anchorText,
      linkType: link.linkType,
    })
    if (existingKeys.has(candidateKey)) continue

    const row = await resolveScannedLink(req.payload as Payload, link)
    toAdd.push(row)
    existingKeys.add(candidateKey)
  }

  if (toAdd.length === 0) return data

  return { ...data, seoInternalLinks: [...existing, ...toAdd] }
}

function keyFor(row: { anchorText?: string; linkType?: string }): string {
  return `${row.linkType ?? ''}:${(row.anchorText ?? '').toLowerCase().trim()}`
}

async function resolveScannedLink(
  payload: Payload,
  link: ScannedLink,
): Promise<SeoLinkRow> {
  const base: SeoLinkRow = {
    anchorText: link.anchorText,
    linkType: link.linkType,
    injected: false,
  }
  if (link.linkType === 'project' && link.targetProjectSlug) {
    const res = await payload
      .find({
        collection: 'featured-projects',
        where: { slug: { equals: link.targetProjectSlug } },
        depth: 0,
        limit: 1,
      })
      .catch(() => null)
    const id = (res?.docs[0]?.id as number | undefined) ?? null
    return { ...base, targetProject: id }
  }
  if (link.linkType === 'location' && link.targetLocationSlug) {
    return { ...base, targetLocationSlug: link.targetLocationSlug }
  }
  return base
}
