/**
 * Extract plain text from a Lexical serialized state. Used by the Blogs
 * beforeChange hooks to derive `excerpt`, `metaDescription`, `readTime`, and
 * to feed the entity scanner — none of which need the rich-text structure.
 *
 * Accepts the standard Payload Lexical shape `{ root: { children: [...] } }`
 * or any nested node tree. Returns '' for null / undefined / non-object inputs.
 */

type LexicalNode = {
  text?: string
  type?: string
  children?: unknown[]
  root?: unknown
}

/** Recursively collect all `.text` values from a Lexical node tree. */
export function lexicalToPlainText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const parts: string[] = []
  walk(content as LexicalNode, parts)
  // Collapse whitespace runs to single spaces and trim.
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function walk(node: LexicalNode, parts: string[]): void {
  if (!node || typeof node !== 'object') return
  // Skip non-prose blocks — their inner text is decoration not content.
  if (node.type === 'code' || node.type === 'horizontalrule') return

  if (typeof node.text === 'string') parts.push(node.text)

  if (node.root && typeof node.root === 'object') {
    walk(node.root as LexicalNode, parts)
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walk(child as LexicalNode, parts)
    }
  }
}

/**
 * Smart-truncate a plain string to ≤ `max` characters at the nearest word
 * boundary, with an ellipsis when cut. Returns input unchanged if shorter
 * than `max`. Always strips trailing whitespace + punctuation before the
 * ellipsis to avoid "word ,…" artifacts.
 */
export function smartTruncate(input: string, max: number): string {
  const s = (input ?? '').trim()
  if (s.length <= max) return s
  const window = s.slice(0, max + 1)
  const lastSpace = window.lastIndexOf(' ')
  const cut = lastSpace > Math.floor(max * 0.5) ? lastSpace : max
  return s.slice(0, cut).replace(/[\s,.;:!?-]+$/, '') + '…'
}

/** Approximate word count from a plain string. Joiners / punctuation don't count. */
export function countWords(input: string): number {
  return (input || '').trim().split(/\s+/).filter(Boolean).length
}
