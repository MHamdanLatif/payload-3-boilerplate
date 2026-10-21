import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const loaded = { exports: {} }
const code = ts.transpileModule(
  readFileSync(new URL('../../src/lib/section-numbers.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText
vm.runInNewContext(code, {
  module: loaded,
  exports: loaded.exports,
  require: (key) => {
    if (key === '@/lib/featured-projects')
      return {
        sortedUnits: (p) => p.unitTypes ?? [],
        unitSummary: (p) => (p.unitTypes?.length ? {} : null),
      }
    throw Error(`Unexpected import ${key}`)
  },
})
const { numberSections, hasGallery, hasTrackRecord, hasFaqs } = loaded.exports

test('hidden sections are skipped so the visible ones number without gaps', () => {
  // A page like Saima Elite Enclave: no gallery and no builder history.
  const n = numberSections([
    { key: 'gallery', label: 'GALLERY', show: false },
    { key: 'amenities', label: 'AMENITIES', show: true },
    { key: 'location', label: 'LOCATION', show: true },
    { key: 'builder', label: 'THE BUILDER', show: false },
    { key: 'register', label: 'REGISTER INTEREST', show: true },
  ])
  assert.equal(n.gallery, '')
  assert.equal(n.amenities, '01 / AMENITIES')
  assert.equal(n.location, '02 / LOCATION')
  assert.equal(n.builder, '')
  assert.equal(n.register, '03 / REGISTER INTEREST')
})

test('a full page keeps its order, and numbering can continue after a fixed first section', () => {
  const n = numberSections(
    [
      { key: 'units', label: 'AVAILABLE UNITS', show: true },
      { key: 'faq', label: 'FAQ', show: true },
    ],
    2,
  )
  assert.equal(n.units, '02 / AVAILABLE UNITS')
  assert.equal(n.faq, '03 / FAQ')
  const ten = numberSections(
    Array.from({ length: 10 }, (_, i) => ({ key: `s${i}`, label: 'X', show: true })),
  )
  assert.equal(ten.s9, '10 / X')
})

test('visibility checks match what the sections render', () => {
  assert.equal(hasGallery([{ image: null }, { caption: 'no image' }]), false)
  assert.equal(hasGallery([{ image: 12 }]), true)
  assert.equal(hasTrackRecord({ builderTrackRecord: [{}] }), false) // one entry is not a progression
  assert.equal(hasTrackRecord({ builderTrackRecord: [{}, {}] }), true)
  assert.equal(hasFaqs([{ question: 'Q?', answer: '' }]), false)
  assert.equal(hasFaqs([{ question: 'Q?', answer: 'A.' }]), true)
})
