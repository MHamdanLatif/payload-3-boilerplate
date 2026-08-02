// Correct Tulip Comfort pricing across the published Scheme 33 blogs.
// Actual prices (pre-launch discount dropped as it's expiring):
//   Type B (non-duplex flat) 1.95 Cr · Type A (3-bed duplex) 2.77 Cr · Type XL (4-bed duplex) 3.37 Cr
// String-replaces the exact old price sentence in each article's Lexical JSON.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
  .reduce((a, l) => { const i = l.indexOf('='); if (i > -1) { let v = l.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); a[l.slice(0, i).trim()] = v } return a }, {})

const edits = [
  {
    id: 40,
    old: 'Standard pricing starts from around PKR 1.95 crore for the smallest unit, currently discounted to roughly PKR 1.82 crore during the pre-launch phase — both figures indicative and worth confirming against current availability.',
    new: 'The two duplexes are priced at around PKR 2.77 crore (3-bed Type A) and PKR 3.37 crore (4-bed Type XL), while the non-duplex Type B flat sits lower at about PKR 1.95 crore — indicative figures worth confirming against current availability.',
  },
  {
    id: 41,
    old: 'Standard pricing starts from around PKR 1.95 crore for the smallest unit, currently discounted to roughly PKR 1.82 crore during the pre-launch phase (to be confirmed against current availability), with an installment plan spread over roughly five years rather than a single lump-sum payment.',
    new: 'The non-duplex Type B flat is priced at around PKR 1.95 crore, the 3-bed Type A duplex at about PKR 2.77 crore, and the 4-bed Type XL duplex at roughly PKR 3.37 crore (to be confirmed against current availability), with an installment plan spread over roughly five years rather than a single lump-sum payment.',
  },
  {
    id: 43,
    old: 'Standard pricing starts from around PKR 1.95 crore for the smallest unit, currently discounted to roughly PKR 1.82 crore during pre-launch — both figures worth confirming directly against current availability before booking.',
    new: 'Pricing runs from around PKR 1.95 crore for the non-duplex Type B flat to about PKR 2.77 crore for the 3-bed Type A duplex and PKR 3.37 crore for the 4-bed Type XL duplex — figures worth confirming directly against current availability before booking.',
  },
  {
    id: 44,
    old: 'Standard pricing starts from around PKR 1.95 crore, currently discounted to roughly PKR 1.82 crore during the pre-launch phase — to be confirmed against current unit availability before booking.',
    new: 'Pricing runs from around PKR 1.95 crore for the non-duplex Type B flat to about PKR 2.77 crore (3-bed Type A duplex) and PKR 3.37 crore (4-bed Type XL duplex) — to be confirmed against current unit availability before booking.',
  },
  {
    id: 45,
    old: 'Standard pricing starts from around PKR 2.77 crore for the smallest unit, currently discounted to roughly PKR 2.62 crore during the pre-launch phase, subject to confirmation against current unit availability.',
    new: 'The duplexes are priced at around PKR 2.77 crore for the 3-bed (Type A) and about PKR 3.37 crore for the 4-bed (Type XL), subject to confirmation against current unit availability.',
  },
]

const { Client } = pg
const c = new Client({ connectionString: env.DATABASE_URI })
await c.connect()
for (const e of edits) {
  const r = await c.query('SELECT content::text AS t FROM blogs WHERE id=$1', [e.id])
  if (!r.rows.length) { console.log(`#${e.id}  NOT FOUND (no row)`); continue }
  const before = r.rows[0].t
  if (!before.includes(e.old)) { console.log(`#${e.id}  ⚠ OLD STRING NOT MATCHED — skipped`); continue }
  const after = before.replace(e.old, e.new)
  await c.query('UPDATE blogs SET content=$1::jsonb WHERE id=$2', [after, e.id])
  console.log(`#${e.id}  ✓ updated`)
}
// verify no stale numbers remain
const chk = await c.query("SELECT id, (content::text LIKE '%1.82%') AS has_182, (content::text LIKE '%2.62%') AS has_262, (content::text LIKE '%3.37%') AS has_337, (content::text LIKE '%2.77%') AS has_277 FROM blogs WHERE id IN (40,41,43,44,45) ORDER BY id")
console.log('\nverify (stale 1.82/2.62 should be false; 3.37/2.77 true):')
chk.rows.forEach((x) => console.log(`  #${x.id}  1.82=${x.has_182}  2.62=${x.has_262}  3.37=${x.has_337}  2.77=${x.has_277}`))
await c.end()
