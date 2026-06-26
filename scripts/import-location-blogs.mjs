// One-shot: import the six location blog drafts from the scratchpad markdown
// into the Payload `blogs` collection.
//
// The source file uses a hand-rolled labelled format with `=======` delimiters
// separating each post. For each post we extract TITLE, META TITLE, META
// DESCRIPTION, EXCERPT, KEYWORDS and ARTICLE, then:
//
//   1. Rewrite legacy "Jauhar" mentions in every field → "Johar" so the new
//      drafts match the renamed location entity straight away.
//   2. Convert the ARTICLE markdown into a Lexical jsonb structure that
//      mirrors what Payload's editor emits (paragraphs, h2/h3 headings,
//      bullet + ordered lists, blockquotes, inline bold, link nodes).
//   3. INSERT a blog row with status='draft', a slug derived from the title,
//      and a populated meta_title / meta_description.
//   4. INSERT each keyword as a sub-table row keyed to the new blog id.
//
// status stays draft so the user can review before publishing. No featured
// image — they're attaching those manually.
//
// Usage:  node scripts/import-location-blogs.mjs <path-to-markdown>
//         (or with no arg, reads the default scratchpad path)
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import pg from 'pg'

const SRC =
  process.argv[2] ||
  'C:\\Users\\HP\\AppData\\Local\\Temp\\claude\\c--lateef-properties-payload-3-boilerplate\\ee67f35d-f16a-4e97-9064-6da0ea324b88\\scratchpad\\location-blogs.md'

const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=')
    if (i === -1) return acc
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    acc[k] = v
    return acc
  }, {})

/* ─── helpers ────────────────────────────────────────────────────────────── */

// "Jauhar" → "Johar" sweep matches what we ran across existing DB content.
function renameJauhar(s) {
  return s.replace(/Jauhar/g, 'Johar').replace(/jauhar/g, 'johar')
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/'/g, '')          // drop apostrophes so "buyer's" → "buyers"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

const WORDS_PER_MINUTE = 220
function readTimeMin(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

function mongoId() {
  return randomBytes(12).toString('hex')
}

/* ─── markdown → lexical ─────────────────────────────────────────────────── */

// Each output node mirrors the shape Payload's Lexical editor produces. Text
// nodes use bitfield `format` (bit 0 = bold). Link nodes carry `fields.url`.

const FORMAT_BOLD = 1

function textNode(text, format = 0) {
  return {
    mode: 'normal',
    text,
    type: 'text',
    style: '',
    detail: 0,
    format,
    version: 1,
  }
}

function linkNode(text, url) {
  return {
    type: 'link',
    fields: { url, newTab: !url.startsWith('/'), linkType: 'custom' },
    format: '',
    indent: 0,
    version: 1,
    children: [textNode(text)],
    direction: 'ltr',
  }
}

// Split an inline string into text + link + bold nodes.
//   1. First pass: split on [text](url) producing alternating literal and link.
//   2. Second pass on each literal: split on **bold** producing alternating
//      plain text and bold text nodes.
function parseInline(s) {
  const out = []
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIdx = 0
  let m
  while ((m = linkRe.exec(s)) !== null) {
    if (m.index > lastIdx) out.push(...parseBold(s.slice(lastIdx, m.index)))
    out.push(linkNode(m[1], m[2]))
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < s.length) out.push(...parseBold(s.slice(lastIdx)))
  return out.length > 0 ? out : [textNode(s)]
}

function parseBold(s) {
  const out = []
  const re = /\*\*([^*]+)\*\*/g
  let lastIdx = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > lastIdx) out.push(textNode(s.slice(lastIdx, m.index)))
    out.push(textNode(m[1], FORMAT_BOLD))
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < s.length) out.push(textNode(s.slice(lastIdx)))
  return out.length > 0 ? out : [textNode(s)]
}

function paragraph(children) {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    children,
    direction: 'ltr',
    textStyle: '',
    textFormat: 0,
  }
}

function heading(tag, children) {
  return {
    type: 'heading',
    tag,
    format: '',
    indent: 0,
    version: 1,
    children,
    direction: 'ltr',
  }
}

function listItem(value, children) {
  return {
    type: 'listitem',
    value,
    format: '',
    indent: 0,
    version: 1,
    children,
    direction: 'ltr',
  }
}

function listBlock(listType, items) {
  return {
    type: 'list',
    tag: listType === 'number' ? 'ol' : 'ul',
    listType,
    start: 1,
    format: '',
    indent: 0,
    version: 1,
    children: items,
    direction: 'ltr',
  }
}

function quote(children) {
  return {
    type: 'quote',
    format: '',
    indent: 0,
    version: 1,
    children,
    direction: 'ltr',
  }
}

// Block-level parse. Walk lines; group consecutive list items; let blank lines
// terminate the current block.
function markdownToLexical(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      i++
      continue
    }

    // Headings
    let m
    if ((m = trimmed.match(/^(#{1,4})\s+(.+)$/))) {
      const level = m[1].length
      const tag = level === 1 ? 'h2' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
      blocks.push(heading(tag, parseInline(m[2])))
      i++
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      // Collect contiguous quoted lines
      const quoteLines = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(quote(parseInline(quoteLines.join(' '))))
      continue
    }

    // Bullet list
    if (trimmed.startsWith('- ')) {
      const items = []
      let n = 1
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        const itemText = lines[i].trim().slice(2)
        items.push(listItem(n++, parseInline(itemText)))
        i++
      }
      blocks.push(listBlock('bullet', items))
      continue
    }

    // Ordered list (1. 2. etc.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []
      let n = 1
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '')
        items.push(listItem(n++, parseInline(itemText)))
        i++
      }
      blocks.push(listBlock('number', items))
      continue
    }

    // Plain paragraph — may span multiple lines until a blank line.
    const paraLines = [trimmed]
    i++
    while (i < lines.length) {
      const next = lines[i].trim()
      if (next === '') break
      // Don't merge into paragraph if the next line starts a new block
      if (/^(#{1,4}\s|>\s|-\s|\d+\.\s)/.test(next)) break
      paraLines.push(next)
      i++
    }
    blocks.push(paragraph(parseInline(paraLines.join(' '))))
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: blocks,
      direction: 'ltr',
    },
  }
}

/* ─── parse the labelled blog document ───────────────────────────────────── */

function parseBlogDoc(src) {
  // Each post is delimited by lines of 60+ '=' characters. The first segment
  // before the first delimiter is the header note; skip it.
  const chunks = src
    .split(/^=+$/m)
    .map((s) => s.trim())
    .filter((s) => s.includes('TITLE') && s.includes('ARTICLE'))

  return chunks.map(parseLabelledBlock)
}

function parseLabelledBlock(block) {
  // Labels are uppercase, on their own line; the content follows until the
  // next label or end of block.
  const LABELS = [
    'TITLE',
    'META TITLE',
    'META DESCRIPTION',
    'EXCERPT',
    'KEYWORDS',
    'IMAGE PROMPT (for Gemini Pro)',
    'ARTICLE',
  ]
  const labelRe = new RegExp(`^(${LABELS.map((l) => l.replace(/[()]/g, '\\$&')).join('|')})$`)
  const lines = block.split('\n')
  const sections = {}
  let current = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && labelRe.test(trimmed)) {
      current = trimmed
      sections[current] = []
    } else if (current) {
      sections[current].push(line)
    }
  }
  // Trim each section: collapse leading/trailing blank lines but preserve
  // internal paragraph breaks inside ARTICLE.
  const get = (k) => (sections[k] || []).join('\n').replace(/^\s+|\s+$/g, '')

  return {
    title: renameJauhar(get('TITLE')),
    metaTitle: renameJauhar(get('META TITLE')),
    metaDescription: renameJauhar(get('META DESCRIPTION')),
    excerpt: renameJauhar(get('EXCERPT')),
    keywords: renameJauhar(get('KEYWORDS'))
      .split('\n')
      .map((k) => k.trim())
      .filter(Boolean),
    article: renameJauhar(get('ARTICLE')),
  }
}

/* ─── main ───────────────────────────────────────────────────────────────── */

const raw = readFileSync(SRC, 'utf8')
const posts = parseBlogDoc(raw)
console.log(`parsed ${posts.length} blog post(s) from ${SRC}\n`)

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })
await client.connect()

let imported = 0
for (const p of posts) {
  const slug = slugify(p.title)
  const content = markdownToLexical(p.article)
  const wordcount = p.article.replace(/[*#>\-\[\]()]/g, '').trim().split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.round(wordcount / WORDS_PER_MINUTE))

  // Pre-check: any blog already at this slug? Skip with a warning rather than
  // creating an awkward duplicate.
  const existing = await client.query(
    `SELECT id FROM "blogs" WHERE "slug" = $1 LIMIT 1;`,
    [slug],
  )
  if (existing.rows.length > 0) {
    console.log(`skip "${p.title}" — slug "${slug}" already exists (blog id ${existing.rows[0].id})`)
    continue
  }

  const ins = await client.query(
    `INSERT INTO "blogs" (
       "title", "slug", "slug_lock", "status",
       "excerpt", "meta_title", "meta_description",
       "read_time", "content"
     ) VALUES ($1, $2, true, 'draft', $3, $4, $5, $6, $7)
     RETURNING "id";`,
    [
      p.title,
      slug,
      p.excerpt,
      p.metaTitle,
      p.metaDescription,
      readTime,
      JSON.stringify(content),
    ],
  )
  const blogId = ins.rows[0].id

  // Keywords sub-table — each row needs a stable Mongo-style id + _order.
  let order = 1
  for (const kw of p.keywords) {
    await client.query(
      `INSERT INTO "blogs_keywords" ("_order", "_parent_id", "id", "keyword")
       VALUES ($1, $2, $3, $4);`,
      [order++, blogId, mongoId(), kw],
    )
  }

  console.log(`imported #${blogId}  ${p.title}`)
  console.log(`           slug: ${slug}`)
  console.log(`           keywords: ${p.keywords.length}, read_time: ${readTime} min`)
  imported++
}

console.log(`\ndone. ${imported}/${posts.length} blog(s) inserted as drafts.`)
await client.end()
