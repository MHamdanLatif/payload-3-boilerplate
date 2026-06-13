import type { CollectionBeforeChangeHook, Payload } from 'payload'
import type { Blog } from '@/payload-types'
import { findEntityByLocationSlug } from '@/lib/project-mapper'

/**
 * Idempotent publish-time link injector. Triggers on every save where
 * `status === 'published'`. Walks the `seoInternalLinks` array; for each entry
 * not yet `injected`, finds the first un-linked exact match of `anchorText`
 * inside a TextNode in the Lexical content tree, replaces it with a LinkNode
 * wrapping the same text, and flips `injected` to true.
 *
 * - Skip-if-already-linked: text nodes that are descendants of an existing
 *   LinkNode are skipped (don't double-wrap).
 * - Walks paragraph, heading, list, listitem children. Ignores code/quote.
 * - Re-running the hook is a no-op: every entry with `injected: true` is skipped.
 */

type LexicalNode = {
  type: string
  children?: LexicalNode[]
  text?: string
  format?: number | string
  detail?: number
  mode?: string
  style?: string
  tag?: string
  version?: number
  direction?: string | null
  indent?: number
  fields?: { url?: string; newTab?: boolean; linkType?: string }
}

type LexicalRoot = {
  root: LexicalNode
}

type LinkSpec = {
  anchorText: string
  linkType: 'project' | 'location' | 'index'
  targetProject?: number | { id: number } | null
  targetLocationSlug?: string | null
  injected?: boolean | null
}

export const injectInternalLinks: CollectionBeforeChangeHook<Blog> = async ({
  data,
  req,
}) => {
  if (data?.status !== 'published') return data
  if (!data.seoInternalLinks?.length) return data
  if (!data.content || typeof data.content !== 'object') return data

  const content = JSON.parse(JSON.stringify(data.content)) as LexicalRoot
  const links = data.seoInternalLinks as LinkSpec[]

  for (const link of links) {
    if (link.injected) continue
    const url = await resolveUrl(req.payload as Payload, link)
    if (!url) continue
    const wrapped = wrapFirstMatchAsLink(content.root, link.anchorText, url)
    if (wrapped) link.injected = true
  }

  return { ...data, content, seoInternalLinks: links }
}

async function resolveUrl(payload: Payload, link: LinkSpec): Promise<string | null> {
  if (link.linkType === 'index') return '/'
  if (link.linkType === 'project') {
    const ref = link.targetProject
    const id = typeof ref === 'object' && ref ? ref.id : (ref as number | null | undefined)
    if (!id) return null
    try {
      const proj = await payload.findByID({
        collection: 'featured-projects',
        id,
        depth: 0,
      })
      return proj?.slug ? `/projects/${proj.slug}` : null
    } catch {
      return null
    }
  }
  if (link.linkType === 'location') {
    const entry = findEntityByLocationSlug(link.targetLocationSlug ?? '')
    return entry ? `/locations/${entry.slug}` : null
  }
  return null
}

/**
 * Walk the tree. Returns true after the first successful injection so we don't
 * over-wrap a single anchor. Skip nodes already inside a LinkNode parent chain.
 */
function wrapFirstMatchAsLink(root: LexicalNode, anchor: string, url: string): boolean {
  return walk(root, anchor, url, false)
}

function walk(
  node: LexicalNode,
  anchor: string,
  url: string,
  insideLink: boolean,
): boolean {
  if (!node || typeof node !== 'object') return false

  // Skip leaves of types we don't traverse into for anchor wrapping.
  if (node.type === 'code' || node.type === 'quote') return false

  if (!Array.isArray(node.children)) return false

  const insideLinkForChildren = insideLink || node.type === 'link'

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    if (!child) continue

    if (child.type === 'text' && typeof child.text === 'string' && !insideLinkForChildren) {
      const match = findCaseInsensitiveMatch(child.text, anchor)
      if (match) {
        node.children.splice(i, 1, ...splitAndWrap(child, match, anchor, url))
        return true
      }
    }

    if (walk(child, anchor, url, insideLinkForChildren)) return true
  }
  return false
}

function findCaseInsensitiveMatch(
  text: string,
  anchor: string,
): { start: number; end: number } | null {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'i')
  const m = re.exec(text)
  if (!m) return null
  return { start: m.index, end: m.index + m[0].length }
}

function splitAndWrap(
  source: LexicalNode,
  range: { start: number; end: number },
  anchorText: string,
  url: string,
): LexicalNode[] {
  const text = source.text ?? ''
  const before = text.slice(0, range.start)
  const matched = text.slice(range.start, range.end)
  const after = text.slice(range.end)
  const out: LexicalNode[] = []

  if (before) {
    out.push({ ...source, text: before })
  }
  out.push({
    type: 'link',
    format: '',
    indent: 0,
    version: 1,
    fields: { url, newTab: !url.startsWith('/'), linkType: 'custom' },
    children: [
      {
        type: 'text',
        format: source.format ?? 0,
        detail: 0,
        mode: 'normal',
        style: '',
        text: matched,
        version: 1,
      },
    ],
  })
  if (after) {
    out.push({ ...source, text: after })
  }
  // Keep the parameter referenced so TS doesn't complain about unused signature.
  void anchorText
  return out
}
