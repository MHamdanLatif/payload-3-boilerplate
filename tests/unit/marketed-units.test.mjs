import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const module = { exports: {} }
const code = ts.transpileModule(
  readFileSync(new URL('../../src/lib/marketed-projects.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require: (key) => {
    if (key === '@/collections/MarketedProjects') return { normaliseSlugKey: (value) => value }
    throw Error(`Unexpected import ${key}`)
  },
})
const { availabilityLine, unitInterestOptions } = module.exports

test('simple rows retain configuration labels, duplexes, and area range without price or rooms', () => {
  const project = { availableUnits: [
    { name: 'A', type: '2 Bed DD / 3 Bed Lounge', areaSqFt: 1300 },
    { name: 'B', type: '3 Bed Drawing (Duplex)', areaSqFt: 1900 },
    { name: 'C', type: '4 Bed Drawing (Duplex)', areaSqFt: 2250 },
  ] }
  assert.equal(availabilityLine(project), 'Available: 2 Bed DD / 3 Bed Lounge, 3 Bed Drawing (Duplex), 4 Bed Drawing (Duplex) · 1,300–2,250 sq ft')
  assert.deepEqual(Array.from(unitInterestOptions(project)), [
    '2 Bed DD / 3 Bed Lounge', '3 Bed Drawing (Duplex)', '4 Bed Drawing (Duplex)',
  ])
})

test('CMS order is preserved and duplicate types are listed once', () => {
  const project = { availableUnits: [
    { type: '4 Bed Drawing', areaSqFt: 1800 },
    { type: ' 2 Bed Lounge ', areaSqFt: 1800 },
    { type: '4 Bed Drawing', areaSqFt: null },
  ] }
  assert.equal(availabilityLine(project), 'Available: 4 Bed Drawing, 2 Bed Lounge · 1,800 sq ft')
})

test('empty lists and missing or invalid areas do not produce misleading hero text', () => {
  assert.equal(availabilityLine({}), null)
  assert.equal(availabilityLine({ availableUnits: [] }), null)
  assert.equal(availabilityLine({ availableUnits: [{ type: ' ', areaSqFt: 2000 }] }), null)
  for (const areaSqFt of [null, undefined, 0, -1, NaN, Infinity]) {
    assert.equal(availabilityLine({ availableUnits: [{ type: '2 Bed Lounge', areaSqFt }] }), 'Available: 2 Bed Lounge')
  }
})
