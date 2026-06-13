import { ALL_ENTITIES } from './project-mapper'

/**
 * Markdown regex scanner. Walks the article body looking for known
 * project + location entities so we can populate `seoInternalLinks` on
 * the Blog doc. The publish hook converts these into Lexical Link nodes.
 *
 * Strategy:
 *   - Strip fenced code blocks so we don't match inside ```...```.
 *   - Match each entity by its canonical name first, then by aliases.
 *   - Collapse multiple aliases of the same entity to a single record
 *     (keyed by `<kind>:<slug>`), with `anchorText` set to the canonical name.
 *   - If no entities are found, emit a single index fallback so every post
 *     ships with at least one internal link.
 */

export type ScannedLink = {
  anchorText: string
  linkType: 'project' | 'location' | 'index'
  targetProjectSlug?: string
  targetLocationSlug?: string
  injected: false
}

export function scanForEntities(markdown: string): ScannedLink[] {
  const found = new Map<string, ScannedLink>()
  const safe = markdown.replace(/```[\s\S]*?```/g, '')

  for (const entity of ALL_ENTITIES) {
    const candidates = [entity.canonical, ...entity.aliases]
    for (const c of candidates) {
      const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${escaped}\\b`, 'i')
      if (!re.test(safe)) continue

      const key = `${entity.kind}:${entity.slug}`
      if (found.has(key)) continue

      found.set(key, {
        anchorText: entity.canonical,
        linkType: entity.kind,
        targetProjectSlug: entity.kind === 'project' ? entity.slug : undefined,
        targetLocationSlug: entity.kind === 'location' ? entity.slug : undefined,
        injected: false,
      })
      break
    }
  }

  const links = [...found.values()]
  if (links.length === 0) {
    links.push({
      anchorText: 'Lateef Properties',
      linkType: 'index',
      injected: false,
    })
  }
  return links
}
