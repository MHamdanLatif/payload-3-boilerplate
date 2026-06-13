/**
 * Convert markdown to Lexical serialized state.
 *
 * We don't pull in @lexical/markdown's full transformer set because doing so
 * inside a server context creates JSDOM/headless-editor friction. Instead this
 * is a lightweight markdown parser that emits Lexical nodes Payload's RichText
 * component will happily render. Covers the markdown surface the LLM produces:
 *
 *   - paragraphs (blank-line separated)
 *   - H2 / H3 / H4 headings
 *   - unordered and ordered lists
 *   - inline bold (**), italic (*), inline links [text](url)
 *
 * Anything more exotic (tables, code blocks, blockquotes) falls back to plain
 * paragraphs so we never blow up on unexpected output.
 */

type LexicalTextNode = {
  type: 'text'
  format: number
  detail: number
  mode: 'normal'
  style: ''
  text: string
  version: 1
}

type LexicalLinkNode = {
  type: 'link'
  format: ''
  indent: 0
  version: 1
  fields: { url: string; newTab: boolean; linkType: 'custom' }
  children: LexicalTextNode[]
}

type LexicalChild = LexicalTextNode | LexicalLinkNode

type LexicalBlockNode = {
  type: 'paragraph' | 'heading' | 'list' | 'listitem'
  format: '' | 'left' | 'center' | 'right'
  indent: 0
  version: 1
  direction: 'ltr' | null
  children?: unknown[]
  // heading
  tag?: 'h2' | 'h3' | 'h4'
  // list
  listType?: 'bullet' | 'number'
  start?: number
  // listitem
  value?: number
}

const BOLD = 1
const ITALIC = 1 << 1

/**
 * Parse inline markdown segments into Lexical children.
 * Handles `**bold**`, `*italic*`, `[text](url)`.
 */
function parseInline(input: string): LexicalChild[] {
  const out: LexicalChild[] = []
  let i = 0
  const len = input.length

  const pushText = (text: string, format: number) => {
    if (!text) return
    out.push({
      type: 'text',
      format,
      detail: 0,
      mode: 'normal',
      style: '',
      text,
      version: 1,
    })
  }

  let buf = ''
  let format = 0

  while (i < len) {
    const ch = input[i]
    // Link: [text](url)
    if (ch === '[') {
      const closeBracket = input.indexOf(']', i + 1)
      const openParen = closeBracket === -1 ? -1 : input.indexOf('(', closeBracket)
      const closeParen = openParen === -1 ? -1 : input.indexOf(')', openParen)
      if (
        closeBracket !== -1 &&
        openParen === closeBracket + 1 &&
        closeParen !== -1
      ) {
        if (buf) {
          pushText(buf, format)
          buf = ''
        }
        const text = input.slice(i + 1, closeBracket)
        const url = input.slice(openParen + 1, closeParen)
        out.push({
          type: 'link',
          format: '',
          indent: 0,
          version: 1,
          fields: { url, newTab: !url.startsWith('/'), linkType: 'custom' },
          children: [
            {
              type: 'text',
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
              text,
              version: 1,
            },
          ],
        })
        i = closeParen + 1
        continue
      }
    }
    // Bold: **text**
    if (ch === '*' && input[i + 1] === '*') {
      pushText(buf, format)
      buf = ''
      format ^= BOLD
      i += 2
      continue
    }
    // Italic: *text* (single star, not part of bold)
    if (ch === '*') {
      pushText(buf, format)
      buf = ''
      format ^= ITALIC
      i += 1
      continue
    }
    buf += ch
    i += 1
  }
  pushText(buf, format)
  return out
}

function paragraphNode(text: string): LexicalBlockNode {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: parseInline(text),
  }
}

function headingNode(text: string, tag: 'h2' | 'h3' | 'h4'): LexicalBlockNode {
  return {
    type: 'heading',
    tag,
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: parseInline(text),
  }
}

function listNode(items: string[], listType: 'bullet' | 'number'): LexicalBlockNode {
  return {
    type: 'list',
    listType,
    start: 1,
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: items.map((item, i) => ({
      type: 'listitem',
      value: i + 1,
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: parseInline(item),
    })),
  }
}

export function markdownToLexicalState(md: string): {
  root: { type: 'root'; format: ''; indent: 0; version: 1; direction: 'ltr'; children: unknown[] }
} {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: LexicalBlockNode[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line — skip
    if (!trimmed) {
      i++
      continue
    }

    // Headings (## / ### / ####). We treat H1 as H2 since the page already has an H1.
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (hMatch) {
      const level = hMatch[1].length
      const text = hMatch[2]
      const tag: 'h2' | 'h3' | 'h4' = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
      blocks.push(headingNode(text, tag))
      i++
      continue
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(listNode(items, 'bullet'))
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(listNode(items, 'number'))
      continue
    }

    // Paragraph — gather lines until blank
    const paraLines: string[] = [trimmed]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*]\s|\d+\.\s)/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim())
      i++
    }
    blocks.push(paragraphNode(paraLines.join(' ')))
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: blocks,
    },
  }
}

export function countWordsInMarkdown(md: string): number {
  return md.replace(/[#*_`\[\]()-]/g, '').trim().split(/\s+/).filter(Boolean).length
}
