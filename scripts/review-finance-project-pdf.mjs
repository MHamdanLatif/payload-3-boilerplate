// Deterministic PDF content and pagination review; no database or private records.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { renderToBuffer } from '@react-pdf/renderer'

const require = createRequire(import.meta.url)
const payloadRequire = createRequire(import.meta.resolve('payload'))
const { build } = createRequire(payloadRequire.resolve('tsx'))('esbuild')
const out = path.resolve('test-results/finance-project-pdf')
await mkdir(out, { recursive: true })
await build({
  entryPoints: ['src/components/finance/ProjectReportPDF.tsx'],
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  outfile: path.join(out, 'document.mjs'),
})
const { ProjectReportDocument } = await import(pathToFileURL(path.join(out, 'document.mjs')))
const report = {
  filename: 'project-1-report.csv',
  sections: [
    { title: 'Report', rows: [{ project: 'Finance Review Project', period_from: '2026-10-01', period_to: '2026-10-31', note: 'Activity sections cover the period; balance sections are as of period_to (Pakistan time).' }] },
    { title: 'Rules (current)', rows: [{ rule: 'Planned daily budget (whole project)', value: 5000 }] },
    { title: 'Campaigns (planned budgets, not spending)', rows: [{ id: 1, name: 'Launch campaign', meta_campaign_id: '1234567890', start_at: '2026-10-01T04:00:00Z', end_at: null, daily_budget: '5000', funding_target: '150000', status: 'active' }] },
    { title: 'Funding entries in period', rows: Array.from({ length: 12 }, (_, i) => ({ date: '2026-10-01T20:00:00Z', participant: `Investor ${i + 1}`, kind: 'contribution', direction: null, campaign: 'Launch campaign', amount: '20000.00', account: 'Business bank', payment_method: 'Bank transfer', reference: 'Review reference with a long explanation '.repeat(5), voided: false, void_reason: null })) },
    { title: 'Daily Meta amounts and allocated additional charges', rows: Array.from({ length: 70 }, (_, i) => ({ day: '2026-10-02', campaign: `Campaign ${i + 1}`, meta_amount: '10000', additional_bank_charges_taxes: '800', total_advertising_cost: '10800' })) },
    { title: 'Advertising cost allocated to participants in period', rows: [] },
    { title: 'Funding balances as of 2026-10-31', rows: [{ participant: 'Investor 1', funding_percent: 50, received: '20000.00', allocated_costs: '5400.00', refunds: '0.00', adjustments: '0.00', balance: '14600.00', shortfall: '', backed_by_project_cash: '14600.00' }, { participant: 'PROJECT ADVERTISING CASH REMAINING', balance: '9200.00', shortfall: '' }] },
    { title: 'Linked deal commissions (advertising is never deducted)', rows: [{ deal_id: 1, client: 'Review Buyer', commission_agreed: '300000.00', commission_received: '100000.00', direct_deductions: '0.00', distributable: '100000.00', recipient: 'Owner', entitlement: '100000.00', paid: '50000.00', unpaid: '50000.00' }] },
  ],
}
const buffer = await renderToBuffer(ProjectReportDocument({ report, logo: await readFile('public/brand/lateef-logo.png'), generatedAt: '2026-11-07 12:00' }))
await writeFile(path.join(out, 'project.pdf'), buffer)
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const { createCanvas } = createRequire(require.resolve('pdfjs-dist/package.json'))('@napi-rs/canvas')
const standardFontDataUrl = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replaceAll('\\', '/') + '/'
const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), standardFontDataUrl }).promise
let text = ''
for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n)
  const content = (await page.getTextContent()).items.map((item) => item.str).join(' ')
  assert.match(content, new RegExp(`${n} / ${pdf.numPages}`))
  const viewport = page.getViewport({ scale: 1.2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  await writeFile(path.join(out, `page-${n}.png`), canvas.toBuffer('image/png'))
  text += content + '\n'
}
for (const section of report.sections) assert.ok(text.includes(section.title), section.title)
for (const expected of ['Investor 12', 'Campaign 70', '14600.00', '50000.00', '2026-10-02', '2026-10-01 09:00', 'No records']) assert.ok(text.includes(expected), expected)
assert.ok(pdf.numPages > 8, 'Long reports must paginate')
await writeFile(path.join(out, 'project.txt'), text)
console.log(`PASS: ${pdf.numPages} pages rendered; sections, final records, balances, PKT dates and page numbers verified.`)
