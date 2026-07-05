// Import the 18-article blog batch into the Payload `blogs` collection as
// DRAFTS (no images — attached manually later). Reuses the labelled CMS format
// parser from import-location-blogs.mjs:
//   TITLE / META TITLE / META DESCRIPTION / EXCERPT / KEYWORDS /
//   IMAGE PROMPT (for Gemini Pro) / ARTICLE, each block fenced by `====` lines.
//
// Differences vs the location import:
//   1. Repairs UTF-8-as-CP1252 mojibake (em dashes / curly quotes showing as Ã¢...)
//      on the raw file before parsing, so drafts get clean punctuation.
//   2. Skips the file's header chunk (it mentions TITLE/ARTICLE prose but has no
//      real label lines -> empty title), plus any other empty-title block.
//   3. PUBLISHER FLAGS blocks sit outside the `====` fences and lack a TITLE
//      label, so they're ignored automatically.
//
// Usage:  node scripts/import-blog-batch.mjs [path-to-md]   (default: ./lateef-blog-batch.md)
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import pg from 'pg'

const SRC = process.argv[2] || 'lateef-blog-batch.md'
const APPLY = process.argv.includes('--apply')

const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=')
    if (i === -1) return acc
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    acc[k] = v
    return acc
  }, {})

/* ─── mojibake repair ────────────────────────────────────────────────────── */
// Classic double-encoding: UTF-8 bytes decoded as CP1252/Latin-1. Reversing it
// (re-encode as latin1, decode as utf8) restores em dashes, curly quotes, etc.
// Guarded so it only runs when the tell-tale sequences are present, and only
// kept if it actually reduces them.
function fixMojibake(s) {
  const markers = /Ã.|â€|Â|Ã¢/g
  const before = (s.match(markers) || []).length
  if (before === 0) return s
  try {
    const fixed = Buffer.from(s, 'latin1').toString('utf8')
    const after = (fixed.match(markers) || []).length
    return after < before ? fixed : s
  } catch {
    return s
  }
}

/* ─── helpers (from import-location-blogs.mjs) ───────────────────────────── */
function renameJauhar(s) {
  return s.replace(/Jauhar/g, 'Johar').replace(/jauhar/g, 'johar')
}
function slugify(s) {
  return s
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}
const WORDS_PER_MINUTE = 220
function mongoId() {
  return randomBytes(12).toString('hex')
}

/* ─── markdown → lexical ─────────────────────────────────────────────────── */
const FORMAT_BOLD = 1
const textNode = (text, format = 0) => ({ mode: 'normal', text, type: 'text', style: '', detail: 0, format, version: 1 })
const linkNode = (text, url) => ({
  type: 'link',
  fields: { url, newTab: !url.startsWith('/'), linkType: 'custom' },
  format: '', indent: 0, version: 1, children: [textNode(text)], direction: 'ltr',
})
function parseInline(s) {
  const out = []
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIdx = 0, m
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
  let lastIdx = 0, m
  while ((m = re.exec(s)) !== null) {
    if (m.index > lastIdx) out.push(textNode(s.slice(lastIdx, m.index)))
    out.push(textNode(m[1], FORMAT_BOLD))
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < s.length) out.push(textNode(s.slice(lastIdx)))
  return out.length > 0 ? out : [textNode(s)]
}
const paragraph = (children) => ({ type: 'paragraph', format: '', indent: 0, version: 1, children, direction: 'ltr', textStyle: '', textFormat: 0 })
const heading = (tag, children) => ({ type: 'heading', tag, format: '', indent: 0, version: 1, children, direction: 'ltr' })
const listItem = (value, children) => ({ type: 'listitem', value, format: '', indent: 0, version: 1, children, direction: 'ltr' })
const listBlock = (listType, items) => ({ type: 'list', tag: listType === 'number' ? 'ol' : 'ul', listType, start: 1, format: '', indent: 0, version: 1, children: items, direction: 'ltr' })
const quote = (children) => ({ type: 'quote', format: '', indent: 0, version: 1, children, direction: 'ltr' })

function markdownToLexical(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (trimmed === '') { i++; continue }
    let m
    if ((m = trimmed.match(/^(#{1,4})\s+(.+)$/))) {
      const level = m[1].length
      const tag = level === 1 ? 'h2' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
      blocks.push(heading(tag, parseInline(m[2])))
      i++; continue
    }
    if (trimmed.startsWith('> ')) {
      const q = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) { q.push(lines[i].trim().slice(2)); i++ }
      blocks.push(quote(parseInline(q.join(' '))))
      continue
    }
    if (trimmed.startsWith('- ')) {
      const items = []; let n = 1
      while (i < lines.length && lines[i].trim().startsWith('- ')) { items.push(listItem(n++, parseInline(lines[i].trim().slice(2)))); i++ }
      blocks.push(listBlock('bullet', items)); continue
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []; let n = 1
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(listItem(n++, parseInline(lines[i].trim().replace(/^\d+\.\s+/, '')))); i++ }
      blocks.push(listBlock('number', items)); continue
    }
    const paraLines = [trimmed]; i++
    while (i < lines.length) {
      const next = lines[i].trim()
      if (next === '') break
      if (/^(#{1,4}\s|>\s|-\s|\d+\.\s)/.test(next)) break
      paraLines.push(next); i++
    }
    blocks.push(paragraph(parseInline(paraLines.join(' '))))
  }
  return { root: { type: 'root', format: '', indent: 0, version: 1, children: blocks, direction: 'ltr' } }
}

/* ─── parse the labelled blog document ───────────────────────────────────── */
function parseBlogDoc(src) {
  return src
    .split(/^=+$/m)
    .map((s) => s.trim())
    .filter((s) => s.includes('TITLE') && s.includes('ARTICLE'))
    .map(parseLabelledBlock)
}
function parseLabelledBlock(block) {
  const LABELS = ['TITLE', 'META TITLE', 'META DESCRIPTION', 'EXCERPT', 'KEYWORDS', 'IMAGE PROMPT (for Gemini Pro)', 'ARTICLE']
  const labelRe = new RegExp(`^(${LABELS.map((l) => l.replace(/[()]/g, '\\$&')).join('|')})$`)
  const sections = {}
  let current = null
  for (const line of block.split('\n')) {
    const t = line.trim()
    if (t && labelRe.test(t)) { current = t; sections[current] = [] }
    else if (current) sections[current].push(line)
  }
  const get = (k) => (sections[k] || []).join('\n').replace(/^\s+|\s+$/g, '')
  return {
    title: renameJauhar(get('TITLE')),
    metaTitle: renameJauhar(get('META TITLE')),
    metaDescription: renameJauhar(get('META DESCRIPTION')),
    excerpt: renameJauhar(get('EXCERPT')),
    keywords: renameJauhar(get('KEYWORDS')).split('\n').map((k) => k.trim()).filter(Boolean),
    article: renameJauhar(get('ARTICLE')),
  }
}

/* ─── main ───────────────────────────────────────────────────────────────── */
const raw = fixMojibake(readFileSync(SRC, 'utf8'))
const posts = parseBlogDoc(raw).filter((p) => p.title) // drop the header/empty chunks
console.log(`parsed ${posts.length} article(s) from ${SRC}  (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })
await client.connect()

let imported = 0, skipped = 0
for (const p of posts) {
  const slug = slugify(p.title)
  const wordcount = p.article.replace(/[*#>\-\[\]()]/g, '').trim().split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.round(wordcount / WORDS_PER_MINUTE))

  const existing = await client.query(`SELECT id FROM "blogs" WHERE "slug" = $1 LIMIT 1;`, [slug])
  if (existing.rows.length > 0) {
    console.log(`skip   "${p.title}"\n       slug "${slug}" already exists (#${existing.rows[0].id})`)
    skipped++; continue
  }

  if (!APPLY) {
    console.log(`would import  ${p.title}\n              slug: ${slug}  |  keywords: ${p.keywords.length}  |  ~${readTime} min`)
    continue
  }

  const content = markdownToLexical(p.article)
  const ins = await client.query(
    `INSERT INTO "blogs" ("title","slug","slug_lock","status","excerpt","meta_title","meta_description","read_time","content")
     VALUES ($1,$2,true,'draft',$3,$4,$5,$6,$7) RETURNING "id";`,
    [p.title, slug, p.excerpt, p.metaTitle, p.metaDescription, readTime, JSON.stringify(content)],
  )
  const blogId = ins.rows[0].id
  let order = 1
  for (const kw of p.keywords) {
    await client.query(
      `INSERT INTO "blogs_keywords" ("_order","_parent_id","id","keyword") VALUES ($1,$2,$3,$4);`,
      [order++, blogId, mongoId(), kw],
    )
  }
  console.log(`imported #${blogId}  ${p.title}\n           slug: ${slug}  |  keywords: ${p.keywords.length}  |  ~${readTime} min`)
  imported++
}

console.log(`\ndone. ${imported} inserted, ${skipped} skipped (already existed), of ${posts.length} parsed.`)
await client.end()
