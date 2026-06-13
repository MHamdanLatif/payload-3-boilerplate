// One-shot: replace the un-generated blog topics with a fresh 23-topic list,
// assigned random priorities so the cron picks them in random order.
// Generated topics (where isGenerated=true) are preserved.
//
// Iteration history:
//   v1 (20 topics): initial keyword cluster
//   v2 (23 topics): trimmed 4 cannibalising topics, added 7 high-intent ones
//                   (brand-name projects, price-threshold, comparison, Gulshan-e-Iqbal, expat)
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

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

const TOPICS = [
  // ── Pre-launch cluster (kept 3, dropped the 4th) ────────────────────────
  {
    suggestedTitle:
      'Pre-Launch vs. Ready-to-Move: Which Investment Yields the Highest ROI?',
    coreFocus:
      'Side-by-side comparison of pre-launch and ready-to-move properties in Karachi. Walk through ROI math, holding-period assumptions, liquidity trade-offs, and which buyer profile each suits best.',
    targetKeywords: [
      'pre-launch vs ready to move',
      'Karachi property ROI',
      'real estate investment Karachi',
      'pre-launch ROI Karachi',
      'ready-to-move apartment Karachi',
    ],
  },
  {
    suggestedTitle:
      'A Step-by-Step Guide to Securing the Best Rates During Project Pre-Launches',
    coreFocus:
      'Practical playbook: when to book, what discounts to ask for, how to negotiate payment plans, and what to confirm before signing the allocation letter.',
    targetKeywords: [
      'pre-launch booking Karachi',
      'pre-launch rates Karachi',
      'securing pre-launch allocation',
      'Karachi apartment booking',
      'pre-launch discount Karachi',
    ],
  },
  {
    suggestedTitle:
      "How to Evaluate a Developer's Credibility Before a Pre-Launch Investment",
    coreFocus:
      "Checklist for assessing a Karachi developer's track record — past completions on time, financial stability signals, project handover quality, and red flags to watch for.",
    targetKeywords: [
      'developer credibility Karachi',
      'Karachi real estate developers',
      'evaluating builders Karachi',
      'pre-launch due diligence',
      'trusted developer Karachi',
    ],
  },

  // ── Scheme 33 cluster (kept 3, dropped the 4th) ─────────────────────────
  {
    suggestedTitle:
      'Scheme 33 Neighborhood Guide: The Future of Affordable Luxury in Karachi',
    coreFocus:
      'A neighborhood profile of Scheme 33 — lifestyle, daily-life amenities, accessibility, demographics, and who Scheme 33 suits as a place to live.',
    targetKeywords: [
      'Scheme 33 neighborhood',
      'Scheme 33 lifestyle',
      'Karachi affordable luxury',
      'Scheme 33 apartments',
      'living in Scheme 33',
    ],
  },
  {
    suggestedTitle:
      "Infrastructure and Growth: Why Scheme 33 is Karachi's Fastest-Growing Hub",
    coreFocus:
      'Cover the planned and recent infrastructure drivers behind Scheme 33 — road connectivity, schools, hospitals, commercial development — and how each translates into property appreciation.',
    targetKeywords: [
      'Scheme 33 infrastructure',
      'Karachi growth area',
      'Scheme 33 development',
      "Karachi's fastest growing area",
      'Scheme 33 connectivity',
    ],
  },
  {
    suggestedTitle: 'Top Amenities Families Look for When Moving to Scheme 33',
    coreFocus:
      'A family-buyer perspective on Scheme 33 — schools, parks, security, healthcare access, daily-life essentials. What separates the well-served pockets from the rest.',
    targetKeywords: [
      'family living Scheme 33',
      'Scheme 33 amenities',
      'Karachi family neighborhood',
      'schools Scheme 33',
      'Scheme 33 for families',
    ],
  },

  // ── Jinnah Avenue cluster (kept 1, dropped 2) ───────────────────────────
  {
    suggestedTitle:
      'Jinnah Avenue Real Estate: Analyzing Connectivity and Commercial Growth',
    coreFocus:
      'Deep-dive on what makes the Jinnah Avenue corridor work — transport links, business cluster effects, ripple effects on adjacent neighborhoods, why connectivity drives long-term value.',
    targetKeywords: [
      'Jinnah Avenue connectivity',
      'Karachi commercial growth',
      'Jinnah Avenue investment',
      'central Karachi real estate',
      'M.A. Jinnah Road commercial',
    ],
  },

  // ── Gulistan-e-Jauhar cluster (kept all 3) ──────────────────────────────
  {
    suggestedTitle:
      'Gulistan-e-Jauhar Area Guide: Navigating the Modern Apartment Lifestyle',
    coreFocus:
      'A complete area guide to Gulistan-e-Jauhar — building types, block-by-block character, lifestyle on offer, and who Jauhar suits as a place to live.',
    targetKeywords: [
      'Gulistan-e-Jauhar Karachi',
      'Jauhar apartments',
      'Gulistan-e-Jauhar lifestyle',
      'Jauhar real estate',
      'living in Gulistan-e-Jauhar',
    ],
  },
  {
    suggestedTitle:
      'Why Proximity to University Road Makes Gulistan-e-Jauhar a Prime Choice',
    coreFocus:
      'Make the case for Gulistan-e-Jauhar via its University Road access — academic ecosystem, commute, rental demand from students and faculty, and why that drives end-user value.',
    targetKeywords: [
      'Gulistan-e-Jauhar location',
      'University Road Karachi',
      'Jauhar rental demand',
      'Karachi central living',
      'Jauhar accessibility',
    ],
  },
  {
    suggestedTitle:
      'The Ultimate Checklist for Buying a Two-Bed Apartment in Gulistan-e-Jauhar',
    coreFocus:
      'Practical buyer checklist for a 2-bed apartment in Gulistan-e-Jauhar — area sub-pockets to consider, documents to ask for, price-per-square-foot benchmarks, and negotiation points.',
    targetKeywords: [
      'two bed apartment Jauhar',
      '2 bed Gulistan-e-Jauhar',
      'buying apartment Karachi',
      'apartment checklist Karachi',
      '2 bed flat Jauhar price',
    ],
  },

  // ── DHA cluster (kept both) ─────────────────────────────────────────────
  {
    suggestedTitle:
      'DHA Karachi Investment Guide: Navigating Premium Real Estate Opportunities',
    coreFocus:
      'Phase-by-phase investor guide to DHA Karachi — current price benchmarks, what works for end-users vs investors, infrastructure, demand drivers.',
    targetKeywords: [
      'DHA Karachi',
      'DHA Karachi investment',
      'DHA property Karachi',
      'premium real estate Karachi',
      'DHA phases Karachi',
    ],
  },
  {
    suggestedTitle: 'The Evolution of DHA Real Estate: What Modern Buyers Demand',
    coreFocus:
      'How DHA Karachi has evolved — shift from villas to apartment living, demand for gated complexes, amenities buyers expect today, and where DHA is heading next.',
    targetKeywords: [
      'DHA Karachi trends',
      'modern DHA buyer',
      'DHA Karachi real estate',
      'premium Karachi property',
      'DHA apartments Karachi',
    ],
  },

  // ── Buyer-intent & market evergreen ─────────────────────────────────────
  {
    suggestedTitle:
      '2026 Karachi Real Estate Market Outlook: Trends Every Investor Must Know',
    coreFocus:
      'A 2026 outlook for Karachi real estate — macro trends, hot pockets, where prices are likely to move, what investors should watch this year.',
    targetKeywords: [
      'Karachi real estate 2026',
      'Karachi property market outlook',
      'Karachi investment trends',
      'Karachi real estate forecast',
      'Karachi property prices 2026',
    ],
  },
  {
    suggestedTitle:
      "A First-Time Buyer's Checklist for Securing an Apartment in Karachi",
    coreFocus:
      'Step-by-step playbook for first-time buyers in Karachi — choosing the right area, document checks, payment-plan navigation, common pitfalls, and how to negotiate.',
    targetKeywords: [
      'first time buyer Karachi',
      'buying apartment Karachi',
      'Karachi apartment guide',
      'first home Karachi',
      'Karachi property buying checklist',
    ],
  },
  {
    suggestedTitle:
      'The Rise of Comfort-Focused Residential Enclaves in Modern Karachi',
    coreFocus:
      'Track the rise of gated, amenity-led residential developments across Karachi — what they offer, why they command a premium, and which projects exemplify the trend.',
    targetKeywords: [
      'gated community Karachi',
      'residential enclave Karachi',
      'modern apartments Karachi',
      'Karachi luxury living',
      'Karachi gated developments',
    ],
  },
  {
    suggestedTitle:
      "How to Identify High-Yield Rental Properties in Karachi's Current Market",
    coreFocus:
      'Practical guide to finding strong rental-yield properties in Karachi — yield calculation, areas with strong tenant demand, what drives premium rents, and red flags to avoid.',
    targetKeywords: [
      'rental yield Karachi',
      'rental property Karachi',
      'high yield property Karachi',
      'Karachi rental investment',
      'best rental area Karachi',
    ],
  },

  // ── NEW: brand-name project deep-dives (highest-intent, lowest-competition) ──
  {
    suggestedTitle:
      'Saima Elite Enclave: Price, Payment Plan & Location Guide',
    coreFocus:
      'Investor-led overview of Saima Elite Enclave in Scheme 33 — current starting-price benchmarks, payment-plan structure, location advantages, unit types and who the project suits. Include a clear "verify current pricing with the developer" line because plans change month-to-month.',
    targetKeywords: [
      'Saima Elite Enclave',
      'Saima Elite Enclave price',
      'Saima Elite Enclave payment plan',
      'Saima Elite Enclave Scheme 33',
      'Saima Elite Enclave location',
    ],
  },
  {
    suggestedTitle: "Tulip Comfort Karachi: An Investor's Complete Review",
    coreFocus:
      'A complete review of Tulip Comfort — project positioning in Scheme 33, unit types and sizes, payment-plan structure, surrounding amenities, and who the project best suits. Note that pricing should be confirmed with the developer at booking time.',
    targetKeywords: [
      'Tulip Comfort Karachi',
      'Tulip Comfort price',
      'Tulip Comfort Scheme 33',
      'Tulip Comfort payment plan',
      'Tulip Comfort review',
    ],
  },

  // ── NEW: price-threshold queries (huge search volume) ────────────────────
  {
    suggestedTitle:
      'Best Apartments in Karachi Under 2 Crore: Where to Look in 2026',
    coreFocus:
      'Curated overview of areas and project types fitting the sub-2-crore budget in 2026 — Gulistan-e-Jauhar, Scheme 33, FB Area, North Nazimabad. What buyers can realistically get at this price point and what to compromise on.',
    targetKeywords: [
      'apartments in Karachi under 2 crore',
      'affordable apartments Karachi',
      '2 crore apartment Karachi',
      'budget apartment Karachi 2026',
      'Karachi apartment under 2 crore',
    ],
  },
  {
    suggestedTitle:
      "Best Apartments in Karachi Under 5 Crore: A Buyer's Shortlist",
    coreFocus:
      'Premium-mid-tier shortlist for the sub-5-crore budget — DHA, upper Scheme 33, Gulshan-e-Iqbal, premium Jauhar projects. What separates a 5-crore apartment from a 2-crore one (size, society, amenities, finish).',
    targetKeywords: [
      'apartments in Karachi under 5 crore',
      'premium apartments Karachi',
      '5 crore apartment Karachi',
      'luxury apartment Karachi',
      'best apartments under 5 crore Karachi',
    ],
  },

  // ── NEW: comparison query (winsfeatured snippets) ────────────────────────
  {
    suggestedTitle: 'Bahria Town vs DHA Karachi: Which Is Better for Investment?',
    coreFocus:
      'Honest side-by-side comparison — infrastructure, lifestyle, ROI track record, liquidity, resident demographics, transfer process. Show which investor profile each better serves rather than crowning a winner.',
    targetKeywords: [
      'Bahria Town vs DHA Karachi',
      'DHA vs Bahria Town',
      'Bahria Town Karachi investment',
      'DHA Karachi investment',
      'best society Karachi',
    ],
  },

  // ── NEW: Gulshan-e-Iqbal (where the office is!) ──────────────────────────
  {
    suggestedTitle:
      'Gulshan-e-Iqbal Real Estate Guide: Apartments, Prices & Lifestyle',
    coreFocus:
      'Block-by-block area guide for Gulshan-e-Iqbal — current price ranges, family vs investor angle, schools, accessibility, building stock, and what makes specific blocks (e.g. Block 16) sought-after.',
    targetKeywords: [
      'Gulshan-e-Iqbal Karachi',
      'Gulshan-e-Iqbal apartments',
      'Gulshan-e-Iqbal real estate',
      'Gulshan-e-Iqbal property price',
      'living in Gulshan-e-Iqbal',
    ],
  },

  // ── NEW: diaspora buyer playbook ─────────────────────────────────────────
  {
    suggestedTitle:
      'How to Buy Property in Karachi from Abroad: A Returning-Pakistani Playbook',
    coreFocus:
      'Step-by-step for expatriate buyers — power of attorney process, remote viewing options, currency conversion, payment from foreign bank accounts, tax considerations on remittances and rental income.',
    targetKeywords: [
      'buy property Karachi from abroad',
      'returning Pakistani property',
      'NRP property Karachi',
      'expat property Pakistan',
      'remote property purchase Karachi',
    ],
  },
]

// Fisher–Yates shuffle to randomise topic order, then assign priorities 1..N.
function shuffle(arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })
await client.connect()

// 1. Wipe any un-generated topics. Preserve generated ones (linked to blog posts).
const del = await client.query(
  `DELETE FROM blog_topics WHERE is_generated = false RETURNING id`,
)
console.log(`wiped ${del.rowCount} un-generated topics`)

// 2. Shuffle and assign priorities 1..N.
const ordered = shuffle(TOPICS)

let inserted = 0
for (let i = 0; i < ordered.length; i++) {
  const t = ordered[i]
  const priority = i + 1

  const existing = await client.query(
    `SELECT id FROM blog_topics WHERE suggested_title = $1 LIMIT 1`,
    [t.suggestedTitle],
  )
  if (existing.rowCount > 0) {
    console.log(`skip (already exists): ${t.suggestedTitle}`)
    continue
  }

  const ins = await client.query(
    `INSERT INTO blog_topics
       (suggested_title, core_focus, priority, is_generated, generation_attempts, created_at, updated_at)
     VALUES ($1, $2, $3, false, 0, now(), now())
     RETURNING id`,
    [t.suggestedTitle, t.coreFocus, priority],
  )
  const topicId = ins.rows[0].id

  for (let k = 0; k < t.targetKeywords.length; k++) {
    await client.query(
      `INSERT INTO blog_topics_target_keywords (id, _parent_id, _order, keyword)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), topicId, k + 1, t.targetKeywords[k]],
    )
  }

  inserted++
  console.log(`+ priority ${priority}: ${t.suggestedTitle}`)
}

await client.end()
console.log(`done. inserted=${inserted}/${ordered.length}`)
