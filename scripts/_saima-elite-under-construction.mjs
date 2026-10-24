// Saima Elite Enclave has left pre-launch: it is now Under Construction with
// bookings open, and Types 2B1 and 1A1 are sold out (so available units start
// at Type 2B, PKR 2.5 Cr). Updates the project record and every published blog
// sentence that still calls it pre-launch, quotes the old PKR 2.05 Cr entry or
// promises an upcoming launch/price revision.
//
// Dry run (read-only) by default; pass --apply to write in one transaction. Requires the featured_projects_unit_types.sold_out
// column (migration 20261024_000000_unit_sold_out).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// pg is not a direct dependency; borrow the copy the Postgres adapter uses.
const fromAdapter = createRequire(createRequire(import.meta.url).resolve('@payloadcms/db-postgres'))
const pg = fromAdapter('pg')

const APPLY = process.argv.includes('--apply')
const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
  .reduce((a, l) => { const i = l.indexOf('='); if (i > -1) { let v = l.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); a[l.slice(0, i).trim()] = v } return a }, {})

const PROJECT_ID = 6
const SOLD_OUT = ['Type 2B1', 'Type 1A1']

const project = {
  status: 'Under Construction',
  summary:
    'Bookings now open on 2, 3 and 4-bedroom apartments in Gulistan-e-Johar Block 11, near Kamran Chowrangi. Now under construction. Explore floor plans, prices and payment plans.',
  meta_description:
    'Bookings now open at Saima Elite Enclave, Gulistan-e-Johar Block 11: under-construction 2, 3 & 4-bed apartments. Explore prices, floor plans and installment plans.',
}

// Long description (Lexical) — exact text-node substrings.
const descriptionEdits = [
  ['the project is accepting bookings at pre-launch prices.', 'the project is now under construction and bookings are open.'],
  ['Choose from nine layouts', 'Choose from nine layouts (Types 2B1 and 1A1 are now sold out)'],
  ['Prices start from PKR 2.05 crore.', 'Prices for available apartments start from PKR 2.5 crore.'],
]

const faqEdits = [
  [
    'Base prices start from PKR 2.05 crore for Type 2B1 and reach PKR 4.24 crore for Type XL.',
    'Base prices for available apartments start from PKR 2.5 crore for Type 2B and reach PKR 4.24 crore for Type XL. Types 2B1 and 1A1 are sold out.',
  ],
  [
    'Type 2B1 starts with PKR 6.5 lakh on booking, followed by separate allocation and confirmation payments of PKR 6.5 lakh each. Amounts vary by apartment type.',
    'The initial payment is split into booking, allocation and confirmation instalments. Amounts vary by apartment type, so select a unit in the payment plan above to see its exact figures.',
  ],
]

// Blogs: { id: { excerpt?, meta_description?, content: [[old, new], ...] } }
const blogs = {
  2: {
    excerpt: [
      'A pre-launch tower in Block 11, from PKR 2.05 crore on a 36-month plan — already more than half built.',
      'An under-construction tower in Block 11 with bookings now open, from PKR 2.5 crore on a 36-month plan — already more than half built.',
    ],
    meta_description: [
      '2, 3 & 4-bed apartments from PKR 2.05 Cr on a 36-month plan, near Kamran Chowrangi. Book before the price revision.',
      'bookings now open on 2, 3 & 4-bed apartments from PKR 2.5 Cr on a 36-month plan, near Kamran Chowrangi.',
    ],
    content: [
      [
        "The short answer is that this is a pre-launch tower in Block 11, near Kamran Chowrangi, priced from PKR 2.05 crore on a 36-month plan — and with more than half the grey structure already built, it's far further along than most projects still selling at pre-launch rates.",
        "The short answer is that this is an under-construction tower in Block 11, near Kamran Chowrangi, with bookings now open from PKR 2.5 crore on a 36-month plan — and with more than half the grey structure already built, it's far further along than most projects buyers weigh at this price.",
      ],
      [
        'Pricing starts at PKR 2.05 crore, which puts the project at the accessible end of premium Gulistan-e-Johar stock rather than the top of it.',
        'Pricing for the available units starts at PKR 2.5 crore, which puts the project at the accessible end of premium Gulistan-e-Johar stock rather than the top of it. Two layouts, Type 2B1 and Type 1A1, have already sold out.',
      ],
      ['The pre-launch apartments Gulistan-e-Johar buyers are watching', 'Under-construction apartments in Gulistan-e-Johar, bookings now open'],
      [
        'More than half of the grey structure is already complete, yet the project is still selling at pre-launch pricing. That combination is unusual — most pre-launch apartments Gulistan-e-Johar buyers consider are still at the foundation stage, where the wait is longest and the uncertainty highest.',
        'More than half of the grey structure is already complete, and bookings are open now. That combination is unusual — most new apartments Gulistan-e-Johar buyers consider are still at the foundation stage, where the wait is longest and the uncertainty highest.',
      ],
      [
        'More than half the structure is already built, but the price still reflects pre-launch rates — the kind of window that tends to close at launch.',
        'More than half the structure is already built and bookings are open — so there is a real building to walk before you commit.',
      ],
      [
        'The developer is expected to formally launch within a month or two, and a price revision is anticipated when that happens. In plain terms, the current 2.05 crore entry reflects pre-launch rates on a building that is already well out of the ground. Buyers who move before the official launch are likely looking at the lowest entry point the project will offer.',
        'Saima Elite Enclave is now officially under construction, with bookings open. In plain terms, the PKR 2.5 crore entry buys into a building that is already well out of the ground. Two layouts have already sold out, so confirm current availability for the unit you want before planning around it.',
      ],
      [
        'which is exactly the risk most pre-launch buyers worry about in the first place.',
        'which is exactly the risk most off-plan buyers worry about in the first place.',
      ],
      [
        'confirm the current price and payment schedule, then book a site visit before the formal launch and the expected revision.',
        'confirm the current price, availability and payment schedule for the unit you want, then book a site visit while your preferred layout is still available.',
      ],
    ],
  },
  // Blogs 3–33 hyperlink the project and area names, so each sentence spans
  // several text nodes. Edits target the text on either side of the links,
  // leaving the link nodes untouched.
  3: {
    content: [
      [
        " Block 11 near Kamran Chowrangi, is a late-stage pre-launch. More than half of its grey structure is already complete, yet it's still selling at pre-launch rates from PKR 2.05 crore on a 36-month plan, with an official launch and price revision expected within a month or two. An advanced building still at pre-launch pricing, with the revision close, is about as short and visible as the window gets — the off-plan wait is shorter, and there's a real structure to walk before you commit.",
        ' Block 11 near Kamran Chowrangi, shows the other end of the timeline. It is now under construction with bookings open, more than half of its grey structure is complete, and available units start from PKR 2.5 crore on a 36-month plan. A buyer there gives up the earliest entry price in exchange for a much shorter off-plan wait and a real structure to walk before committing.',
      ],
    ],
  },
  5: {
    content: [
      [
        'a pre-launch high-rise in Block 11 starting from PKR 2.05 crore on a 36-month plan',
        'an under-construction high-rise in Block 11, with bookings now open from PKR 2.5 crore on a 36-month plan',
      ],
    ],
  },
  9: {
    content: [
      ['Pre-launch developments such as Tulip Comforts in ', 'Developments such as Tulip Comforts in '],
      [
        ', each come with their own schedule and stage triggers',
        ', one still at pre-launch and the other now under construction with bookings open, each come with their own schedule and stage triggers',
      ],
    ],
  },
  10: {
    content: [
      ['A development like Tulip Comforts in ', 'Developments like Tulip Comforts in '],
      [
        ' with its grey structure already well advanced, sits at different points on that build curve — so "pre-launch" is not one risk level but a range.',
        ', one still at pre-launch and the other now under construction with its grey structure well advanced, sit at different points on that build curve — so buying before completion is not one risk level but a range.',
      ],
    ],
  },
  13: {
    content: [
      [
        ' in Gulistan-e-Johar or Tulip Comforts in Scheme 33, where pre-launch pricing buys a larger, newer unit',
        ' in Gulistan-e-Johar, now under construction, or Tulip Comforts in Scheme 33, still at pre-launch, where buying before completion gets a larger, newer unit',
      ],
    ],
  },
  17: {
    content: [
      [', where pre-launch apartments like Tulip Comforts and ', ', where new-build apartments like Tulip Comforts (pre-launch) and '],
      [' trade land for newness and a shorter commute.', ' (under construction) trade land for newness and a shorter commute.'],
    ],
  },
  21: {
    content: [
      [
        'start from PKR 2.05 crore, with construction currently more than halfway complete',
        'start from PKR 2.5 crore, with bookings open and construction currently more than halfway complete',
      ],
    ],
  },
  23: {
    content: [
      ['Pre-launch projects such as Tulip Comforts in ', 'Projects such as Tulip Comforts in '],
      [
        ' publish structured schedules that pair naturally',
        ', one at pre-launch and the other under construction with bookings open, publish structured schedules that pair naturally',
      ],
    ],
  },
  33: {
    content: [
      ['Pre-launch projects such as Tulip Comforts in ', 'Projects such as Tulip Comforts in '],
      [
        ' are the kind of developments our advisors help buyers review',
        ', one at pre-launch and the other now under construction, are the kind of developments our advisors help buyers review',
      ],
    ],
  },
}

/** Replace `old` inside exactly one Lexical text node. Returns false if no single node holds it. */
function replaceInLexical(doc, old, next) {
  let hits = 0
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (typeof n.text === 'string' && n.text.includes(old)) {
      n.text = n.text.replace(old, next)
      hits++
    }
    for (const ch of n.children ?? []) walk(ch)
  }
  walk(doc.root)
  return hits === 1
}

const failures = []
const check = (label, ok) => {
  console.log(`  ${ok ? '✓' : '✗ NOT MATCHED'}  ${label}`)
  if (!ok) failures.push(label)
}

const c = new pg.Client({ connectionString: env.DATABASE_URI })
await c.connect()
try {
  // ── Build every change in memory from read-only SELECTs ───────────────────
  const writes = []

  console.log(`featured_projects #${PROJECT_ID}`)
  const p = (await c.query('SELECT description FROM featured_projects WHERE id=$1', [PROJECT_ID])).rows[0]
  for (const [o, n] of descriptionEdits) check(`description: ${o.slice(0, 50)}`, replaceInLexical(p.description, o, n))
  writes.push([
    'UPDATE featured_projects SET status=$1, summary=$2, meta_description=$3, description=$4::jsonb, updated_at=now() WHERE id=$5',
    [project.status, project.summary, project.meta_description, JSON.stringify(p.description), PROJECT_ID],
  ])

  const faqs = (await c.query('SELECT id, answer FROM featured_projects_faqs WHERE _parent_id=$1', [PROJECT_ID])).rows
  for (const [o, n] of faqEdits) {
    const hit = faqs.filter((f) => f.answer.includes(o))
    check(`faq: ${o.slice(0, 50)}`, hit.length === 1)
    if (hit.length === 1) {
      hit[0].answer = hit[0].answer.replace(o, n)
      writes.push(['UPDATE featured_projects_faqs SET answer=$1 WHERE id=$2', [hit[0].answer, hit[0].id]])
    }
  }

  const units = (await c.query('SELECT name FROM featured_projects_unit_types WHERE _parent_id=$1', [PROJECT_ID])).rows
  check(`sold out rows exist: ${SOLD_OUT.join(', ')}`, SOLD_OUT.every((s) => units.some((u) => u.name === s)))
  writes.push([
    'UPDATE featured_projects_unit_types SET sold_out=(name = ANY($1)) WHERE _parent_id=$2',
    [SOLD_OUT, PROJECT_ID],
  ])

  const after = { project: { ...project, description: p.description, faqs }, blogs: {} }
  for (const [id, e] of Object.entries(blogs)) {
    console.log(`blogs #${id}`)
    const b = (await c.query('SELECT title, meta_title, excerpt, meta_description, content FROM blogs WHERE id=$1', [id])).rows[0]
    for (const col of ['excerpt', 'meta_description']) {
      if (!e[col]) continue
      const [o, n] = e[col]
      check(`${col}: ${o.slice(0, 50)}`, Boolean(b[col]?.includes(o)))
      b[col] = b[col]?.replace(o, n)
    }
    for (const [o, n] of e.content) check(`content: ${o.slice(0, 60)}`, replaceInLexical(b.content, o, n))
    after.blogs[id] = b
    writes.push([
      'UPDATE blogs SET content=$1::jsonb, excerpt=$2, meta_description=$3, updated_at=now() WHERE id=$4',
      [JSON.stringify(b.content), b.excerpt, b.meta_description, id],
    ])
  }

  // ── Leftovers across ALL blogs (post-edit for the edited ones) ─────────────
  // Whole blocks (paragraph, heading, list item) so a sentence split by links is
  // still read as one piece of text.
  const textOf = (n) => n.text ?? (n.children ?? []).map(textOf).join('')
  const blocks = (doc) => {
    const out = []
    const walk = (n) => {
      if (!n) return
      if (['paragraph', 'heading', 'listitem', 'quote'].includes(n.type)) return void out.push(textOf(n))
      for (const ch of n.children ?? []) walk(ch)
    }
    walk(doc?.root)
    return out
  }
  const all = (await c.query('SELECT id, title, meta_title, excerpt, meta_description, content FROM blogs')).rows
  const corpus = all.map((b) => {
    const x = after.blogs[b.id] ?? b
    return [`blog #${b.id}`, [x.title, x.meta_title, x.excerpt, x.meta_description, ...blocks(x.content)]]
  })
  const ap = after.project
  corpus.push(['project', [ap.summary, ap.meta_description, ...blocks(ap.description), ...ap.faqs.map((f) => f.answer)]])
  console.log('\nleftover check (Saima Elite blocks mentioning pre-launch / 2.05 / launch / revision):')
  let leftovers = 0
  for (const [row, chunks] of corpus) {
    // The dedicated post and the project record are entirely about Saima Elite.
    const allSaima = row === 'blog #2' || row === 'project'
    for (const s of chunks.filter(Boolean)) {
      if (!allSaima && !/elite/i.test(s)) continue
      const stale = /pre-?launch|2\.05|formal(ly)? launch|official launch|price revision/i.test(
        // Tulip Comforts is still pre-launch; these phrasings attribute it to Tulip.
        s.replace(/(still |one (still )?)at pre-launch|\(pre-launch\)/gi, ''),
      )
      if (stale) {
        console.log(`  ${row}: ${s.slice(0, 260)}`)
        leftovers++
      }
    }
  }
  if (!leftovers) console.log('  none')

  if (failures.length) throw new Error(`${failures.length} edit(s) did not match — nothing written`)
  if (!APPLY) {
    console.log(`\nDry run — read-only, nothing written. ${writes.length} statements ready; re-run with --apply.`)
  } else {
    await c.query('BEGIN')
    try {
      for (const [sql, params] of writes) await c.query(sql, params)
      await c.query('COMMIT')
      console.log(`\nCOMMITTED ${writes.length} statements`)
    } catch (err) {
      await c.query('ROLLBACK')
      throw err
    }
  }
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exitCode = 1
} finally {
  await c.end()
}
