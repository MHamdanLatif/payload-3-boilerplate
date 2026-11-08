import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(
  readFileSync(new URL('../../src/lib/marketing-page-copy.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, { module, exports: module.exports })

test('campaign copy preserves supported content, media IDs and duplexes without sold-out units or source row IDs', () => {
  const source = {
    id: 42, title: 'Project', summary: 'Summary', builderName: 'Builder', location: 'Scheme 33',
    status: 'Under Construction', salesAvailability: 'available', startingPrice: 12000000,
    elevationImages: [{ id: 'source-image', image: { id: 7, url: '/image.jpg' }, caption: 'Front' }],
    brochure: { id: 8 }, photoGallery: [{ id: 'photo', image: 9, caption: 'Site' }],
    builderTrackRecord: [{ id: 'history', name: 'Previous', image: { id: 10 }, isCurrent: false }],
    amenities: [{ id: 'amenity', name: 'Lift' }],
    unitTypes: [
      { id: 'unit', name: 'A', type: '4 Bed Lounge / 3 Bed Drawing', isDuplex: true, areaSqFt: 1800 },
      { type: '1 Bed Lounge', soldOut: true },
    ],
    description: { root: {} }, paymentPlan: { enabled: true },
  }
  const before = JSON.stringify(source)
  const copy = JSON.parse(JSON.stringify(module.exports.marketingPageCopy(source, 'project-campaign')))
  assert.equal(copy.active, false)
  assert.equal(copy.linkedProject, 42)
  assert.equal(copy.summary, 'Summary')
  assert.equal(copy.brochure, 8)
  assert.deepEqual(copy.elevationImages, [{ image: 7, caption: 'Front' }])
  assert.deepEqual(copy.builderTrackRecord, [{ name: 'Previous', image: 10, isCurrent: false }])
  assert.deepEqual(copy.amenities, [{ name: 'Lift' }])
  assert.deepEqual(copy.availableUnits, [{ name: 'A', type: '4 Bed Lounge / 3 Bed Drawing (Duplex)', areaSqFt: 1800 }])
  assert.equal('paymentPlan' in copy, false)
  assert.equal('description' in copy, false)
  assert.equal(JSON.stringify(source), before)
})
