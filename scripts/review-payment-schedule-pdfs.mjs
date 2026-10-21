// Local deterministic export review; no database, production data or network access.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'

const require = createRequire(import.meta.url)
// esbuild is not a direct dependency; use it directly when hoisted, otherwise through
// payload's own tsx dependency, rather than a pnpm store path.
function loadEsbuild() {
  try {
    return require('esbuild')
  } catch {
    const payloadRequire = createRequire(import.meta.resolve('payload'))
    return createRequire(payloadRequire.resolve('tsx'))('esbuild')
  }
}
const { build } = loadEsbuild()
const root = process.cwd()
const out = path.join(root, 'test-results/payment-schedule-pdfs')
await mkdir(out, { recursive: true })
await build({
  stdin: {
    contents: `export { PaymentPlanDocument, composeDisclaimer } from './src/components/projects/PaymentPlanPDF'; export { computeAdminPlan, summarizeAdminPlan } from './src/lib/admin-payment-plan'; export { finishSchedulePDF, loadUnitLayout } from './src/lib/payment-plan-layout'`,
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: path.join(out, 'review.mjs'),
})
const {
  PaymentPlanDocument,
  composeDisclaimer,
  computeAdminPlan,
  summarizeAdminPlan,
  finishSchedulePDF,
  loadUnitLayout,
} = await import(pathToFileURL(path.join(out, 'review.mjs')))
const layout = await sharp(
  Buffer.from(
    '<svg width="800" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="900" fill="white"/><g fill="none" stroke="#2f3558" stroke-width="5"><rect x="60" y="100" width="680" height="710"/><path d="M400 100V810M60 400H740M400 600H740"/></g><g font-family="Arial" font-size="28" fill="#2f3558"><text x="180" y="250">BEDROOM</text><text x="485" y="250">BEDROOM</text><text x="175" y="600">LOUNGE</text><text x="490" y="510">KITCHEN</text><text x="490" y="710">BATH</text><text x="160" y="60">TYPE A - TEST UNIT LAYOUT</text></g></svg>',
  ),
)
  .png()
  .toBuffer()
const logo = `data:image/png;base64,${(await readFile('public/brand/lateef-logo.png')).toString('base64')}`
const input = {
  projectId: 1,
  unitId: 'a',
  basePrice: 10000000,
  duration: 60,
  installmentStartMonth: 2,
  cadence: 2,
  charges: [
    { id: 'parking', name: 'Parking', amount: 500000, separate: true, month: 6 },
    { id: 'corner', name: 'Corner premium', amount: 100000, separate: false, month: 0 },
  ],
  discounts: [{ id: 'offer', name: 'Negotiated discount', amount: 100000 }],
  heads: [
    {
      id: 'dp',
      name: 'Down payment',
      kind: 'down-payment',
      amount: 1000000,
      method: 'entered',
      count: 2,
      firstMonth: 0,
      intervalMonths: 1,
    },
    {
      id: 'monthly',
      name: 'Monthly installments',
      kind: 'installment',
      amount: 0,
      method: 'calculated',
      count: 60,
      firstMonth: 1,
      intervalMonths: 1,
    },
    {
      id: 'quarterly',
      name: 'Quarterly installments',
      kind: 'installment',
      amount: 50000,
      method: 'entered',
      count: 20,
      firstMonth: 3,
      intervalMonths: 3,
    },
    {
      id: 'half',
      name: 'Half-yearly installments',
      kind: 'installment',
      amount: 100000,
      method: 'entered',
      count: 10,
      firstMonth: 6,
      intervalMonths: 6,
    },
    {
      id: 'year',
      name: 'Yearly installments',
      kind: 'installment',
      amount: 100000,
      method: 'entered',
      count: 5,
      firstMonth: 12,
      intervalMonths: 12,
    },
    {
      id: 'roof',
      name: 'Roof completion',
      kind: 'milestone',
      amount: 200000,
      method: 'entered',
      count: 1,
      firstMonth: 0,
      intervalMonths: 0,
    },
    {
      id: 'possession',
      name: 'Possession',
      kind: 'possession',
      amount: 500000,
      method: 'entered',
      count: 1,
      firstMonth: 0,
      intervalMonths: 0,
    },
  ],
}
const computed = computeAdminPlan(input)
assert.equal(computed.plan.warnings.length, 0)
const withLoan = computeAdminPlan({ ...input, includeLoan: true, loanAmount: 1000000 })
assert.equal(withLoan.plan.warnings.length, 0)
const props = {
  projectTitle: 'Payment Schedule Review',
  projectLocation: 'Scheme 33, Karachi',
  builderName: 'Test Builder',
  selectedUnitType: 'Type A (2 Bed Lounge)',
  totalDurationMonths: 60,
  installmentStartMonth: 2,
  buyer: { name: 'Schedule Review Client', phone: '03001234567' },
  loanIncluded: false,
  loanAmount: 0,
  lateefLogoUrl: logo,
  projectLogoUrl: null,
  disclaimer: composeDisclaimer(),
  generatedAt: '12/10/2026',
  priceBreakdown: computed.breakdown,
  scheduleLabel: 'Custom schedule',
  layoutImage: `data:image/png;base64,${layout.toString('base64')}`,
  pageNumbers: false,
  loanOnDemand: true,
}
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const canvasRequire = createRequire(require.resolve('pdfjs-dist/package.json'))
const { createCanvas } = canvasRequire('@napi-rs/canvas')
const standardFontDataUrl =
  path
    .join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
    .replaceAll('\\', '/') + '/'
for (const format of ['full', 'summary', 'loan']) {
  const result = format === 'loan' ? withLoan : computed
  const rendered = await renderToBuffer(
    PaymentPlanDocument({
      ...props,
      summary: format === 'summary',
      plan: format === 'summary' ? summarizeAdminPlan(result.plan) : result.plan,
      priceBreakdown: result.breakdown,
      loanIncluded: result.loanAmount > 0,
      loanAmount: result.loanAmount,
    }),
  )
  // The route numbers pages after merging; review the same final output.
  const buffer = Buffer.from(await finishSchedulePDF(rendered))
  await writeFile(path.join(out, `${format}.pdf`), buffer)
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), standardFontDataUrl }).promise
  let text = ''
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.4 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    await writeFile(path.join(out, `${format}-${pageNumber}.png`), canvas.toBuffer('image/png'))
    text += (await page.getTextContent()).items.map((i) => i.str).join(' ') + '\n'
  }
  assert.match(text, /Documentation charges for utility connections/)
  assert.match(text, /Parking/)
  assert.match(text, /Month 6/)
  assert.match(text.replaceAll(' ', ''), /UNITLAYOUT/)
  assert.match(text, /Schedule Review Client/)
  assert.match(text, /03001234567/)
  // The unit layout page (last) names the project only, never the client.
  assert.doesNotMatch(text.trim().split('\n').at(-1), /Prepared for|Schedule Review Client/)
  for (let n = 1; n <= pdf.numPages; n++) assert.match(text, new RegExp(`${n} / ${pdf.numPages}`))
  if (format === 'summary') {
    assert.match(text, /x 20/)
    assert.match(text, /x 10/)
    assert.match(text, /x 5 /)
  }
  if (format === 'loan') {
    assert.match(text, /Loan amount: PKR 1,000,000 – payable when demanded by the company./)
    assert.match(text, /including loan/)
  } else assert.doesNotMatch(text, /Loan amount/)
  await writeFile(path.join(out, `${format}.txt`), text)
  console.log(`${format}: ${pdf.numPages} pages rendered and content verified`)
  const attachment = await PDFDocument.create()
  attachment.addPage().drawText('Original PDF unit layout')
  const joined = await finishSchedulePDF(rendered, Buffer.from(await attachment.save()))
  assert.equal((await PDFDocument.load(joined)).getPageCount(), pdf.numPages + 1)
  const merged = await pdfjs.getDocument({
    data: new Uint8Array(joined),
    standardFontDataUrl,
  }).promise
  const last = await merged.getPage(merged.numPages)
  assert.match(
    (await last.getTextContent()).items.map((i) => i.str).join(' '),
    new RegExp(`${merged.numPages} / ${merged.numPages}`),
  )
}
// WebP is the CMS default, but the PDF renderer needs a PNG/JPEG source.
const originalFetch = globalThis.fetch
globalThis.fetch = async () => new Response(await sharp(layout).webp().toBuffer())
try {
  const normalized = await loadUnitLayout(
    { url: '/api/media/file/layout.webp', mimeType: 'image/webp' },
    'http://fixture.invalid',
  )
  assert.match(normalized.image, /^data:image\/png;base64,/)
} finally {
  globalThis.fetch = originalFetch
}
console.log(
  'PASS: full/summary PDF text, PNG renders, original PDF attachment and CMS WebP conversion.',
)
