// One-shot: seed 18 Karachi real-estate blog topics. Idempotent —
// only inserts topics whose suggested_title isn't already in the table.
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
  {
    suggestedTitle: 'Best Areas to Buy Apartments in Karachi in 2026',
    coreFocus:
      'Compare Gulshan-e-Iqbal, Scheme 33, DHA and Gulistan-e-Jauhar for buyer profiles, price ranges, and what drives each market. Help the reader pick the right area for their budget and goals.',
    targetKeywords: [
      'Karachi apartments 2026',
      'best area to buy apartment Karachi',
      'Gulshan-e-Iqbal flat',
      'Scheme 33 apartment',
      'DHA Karachi apartment',
    ],
  },
  {
    suggestedTitle: 'Pre-Launch Investment in Karachi: What Smart Buyers Know',
    coreFocus:
      'Explain how pre-launch sales work in Karachi, why entry price beats secondary, what to look for in an allocation letter, and the timing risk of buying before construction starts.',
    targetKeywords: [
      'pre-launch Karachi',
      'allocation letter',
      'pre-launch apartment Karachi',
      'early-bird real estate',
      'Karachi new launches',
    ],
  },
  {
    suggestedTitle: 'Top 7 Family-Friendly Neighbourhoods in Karachi',
    coreFocus:
      'Practical buyer criteria — schools, parks, security, commute times. Rank 7 neighbourhoods (Gulshan, DHA Phase 6, KDA Scheme 33, Bahria Town, Gulistan-e-Jauhar, North Nazimabad, Clifton) with what makes each one work for families.',
    targetKeywords: [
      'family-friendly Karachi',
      'best neighbourhood Karachi for families',
      'gated community Karachi',
      'school district Karachi',
    ],
  },
  {
    suggestedTitle: 'How Karachi Property Prices Have Moved Over the Last 5 Years',
    coreFocus:
      'Trend analysis of Karachi residential and commercial prices from 2020–2026. Identify hot pockets, slowdown areas, and what the next 24 months may look like. Use general directional commentary, not specific PKR price guarantees.',
    targetKeywords: [
      'Karachi property prices',
      'real estate trends Karachi',
      'property price Karachi 2026',
      'Karachi real estate forecast',
    ],
  },
  {
    suggestedTitle: 'Apartment vs Plot in Karachi: Which Builds More Wealth?',
    coreFocus:
      'Compare apartment investing (rental yield, faster liquidity) vs plot investing (higher appreciation, slower exit) with realistic ROI math. Help the reader pick based on horizon and risk tolerance.',
    targetKeywords: [
      'apartment vs plot Karachi',
      'plot investment Karachi',
      'Karachi flat ROI',
      'Karachi plot ROI',
    ],
  },
  {
    suggestedTitle: "The Returning Expatriate's Guide to Buying Property in Karachi",
    coreFocus:
      'Remote viewing, power of attorney, currency conversion, taxation, choosing a trustworthy local advisor. Walk a returning expat through their first Karachi purchase end-to-end.',
    targetKeywords: [
      'expat property Karachi',
      'returning Pakistani buyer',
      'remote property purchase Karachi',
      'NRP property investment',
    ],
  },
  {
    suggestedTitle: "Saima Group Projects in Karachi: An Investor's Overview",
    coreFocus:
      'Overview of Saima Group as a Karachi developer — their portfolio, completion track record, current pre-launch and ready inventory. Factual, no marketing puffery.',
    targetKeywords: [
      'Saima Group',
      'Saima Elite Enclave',
      'Saima Uptown',
      'Tulip Comfort',
      'Saima projects Karachi',
    ],
  },
  {
    suggestedTitle: 'Off-Market Property in Karachi: How Quiet Deals Get Done',
    coreFocus:
      'What off-market means, why it exists (sellers wanting privacy, distress, family-relations sales), how a buyer accesses these listings through advisors. No promises of below-market pricing.',
    targetKeywords: [
      'off-market property Karachi',
      'private real estate Karachi',
      'off-market apartments',
      'exclusive listings Karachi',
    ],
  },
  {
    suggestedTitle: 'Installment Plans for Karachi Apartments: How They Work',
    coreFocus:
      'How developer installment plans are structured in Karachi — down payment, monthly payments, possession-linked instalments. Common terms to watch for. Common buyer pitfalls.',
    targetKeywords: [
      'installment plan Karachi apartment',
      'payment plan',
      'developer installments',
      'Karachi apartment financing',
    ],
  },
  {
    suggestedTitle: 'Gulshan-e-Iqbal vs Scheme 33: Choosing Your Karachi Address',
    coreFocus:
      'Side-by-side comparison for both end-users and investors — infrastructure, demographics, school access, future appreciation outlook.',
    targetKeywords: [
      'Gulshan-e-Iqbal vs Scheme 33',
      'best area in Karachi',
      'Gulshan apartments',
      'Scheme 33 apartments',
    ],
  },
  {
    suggestedTitle: 'DHA Karachi vs Bahria: Two Different Lifestyles, Same Investment Class',
    coreFocus:
      'Compare DHA and Bahria Town Karachi — lifestyle, infrastructure quality, resale velocity, security, value-retention. Help the reader pick based on their priorities.',
    targetKeywords: [
      'DHA Karachi',
      'Bahria Town Karachi',
      'DHA vs Bahria',
      'premium Karachi real estate',
    ],
  },
  {
    suggestedTitle: 'Top Mistakes First-Time Property Buyers Make in Karachi',
    coreFocus:
      'Common buyer mistakes — paying full token without document review, skipping the resale market check, assuming the most expensive area is the best ROI, signing without negotiation.',
    targetKeywords: [
      'first time buyer Karachi',
      'property buying mistakes',
      'Karachi property buying guide',
    ],
  },
  {
    suggestedTitle: 'What to Ask Before Signing a Karachi Property Allocation Letter',
    coreFocus:
      'The 12 essential questions every buyer should ask the developer before signing — completion timeline, possession milestones, surcharge clauses, transfer fees, payment-plan flexibility.',
    targetKeywords: [
      'allocation letter',
      'Karachi property documents',
      'what to ask developer',
      'buying off-plan Karachi',
    ],
  },
  {
    suggestedTitle: 'Why Pre-Launch Pricing Beats Ready Stock in Karachi',
    coreFocus:
      'Entry-price math, capital appreciation during construction, payment-plan flexibility, opportunity cost. When pre-launch is the smarter play and when it isn’t.',
    targetKeywords: [
      'pre-launch vs ready Karachi',
      'ready to move vs pre-launch',
      'Karachi apartment ROI',
    ],
  },
  {
    suggestedTitle: 'The Rental Yield Map of Karachi: Where Tenants Pay the Most',
    coreFocus:
      'Area-by-area rental yield analysis. Which neighbourhoods have the strongest tenant demand, which have oversupply, what a healthy gross yield looks like.',
    targetKeywords: [
      'rental yield Karachi',
      'rental income Karachi',
      'Karachi rental property',
      'best rental area Karachi',
    ],
  },
  {
    suggestedTitle: "How to Read a Karachi Project's Master Plan Like a Pro",
    coreFocus:
      'How to interpret a master plan — layouts, density, common amenities, what to flag (poor ventilation, weak parking ratio, fire-safety access). Help buyers spot issues before signing.',
    targetKeywords: [
      'master plan Karachi project',
      'reading project layout',
      'Karachi apartment floor plan',
    ],
  },
  {
    suggestedTitle: 'Commercial Real Estate in Karachi: Plaza Shops vs Tower Offices',
    coreFocus:
      'ROI comparison between plaza-level shops and tower office floors in Karachi. Vacancy rates, tenant profiles, exit liquidity, common operational costs.',
    targetKeywords: [
      'commercial property Karachi',
      'office for sale Karachi',
      'shop investment Karachi',
      'Karachi commercial ROI',
    ],
  },
  {
    suggestedTitle: 'Building a Karachi Real Estate Portfolio: A 10-Year Framework',
    coreFocus:
      'Long-term portfolio thinking — diversification across apartment / plot / commercial, hold periods, when to exit, when to refinance via secondary sale. A 10-year framework an investor can apply.',
    targetKeywords: [
      'Karachi real estate portfolio',
      'long term property investment',
      'Karachi investor strategy',
    ],
  },
]

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })
await client.connect()

let inserted = 0
let skipped = 0

for (const t of TOPICS) {
  const existing = await client.query(
    'SELECT id FROM blog_topics WHERE suggested_title = $1 LIMIT 1',
    [t.suggestedTitle],
  )
  if (existing.rows.length) {
    skipped++
    continue
  }
  const ins = await client.query(
    `INSERT INTO blog_topics (suggested_title, core_focus, priority, is_generated, generation_attempts, created_at, updated_at)
     VALUES ($1, $2, 100, false, 0, now(), now())
     RETURNING id`,
    [t.suggestedTitle, t.coreFocus],
  )
  const topicId = ins.rows[0].id
  for (let i = 0; i < t.targetKeywords.length; i++) {
    await client.query(
      `INSERT INTO blog_topics_target_keywords (_order, _parent_id, id, keyword)
       VALUES ($1, $2, $3, $4)`,
      [i + 1, topicId, randomUUID(), t.targetKeywords[i]],
    )
  }
  inserted++
}

await client.end()
console.log(`done. inserted=${inserted}, skipped=${skipped}`)
