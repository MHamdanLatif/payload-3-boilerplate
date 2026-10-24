import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const loaded = { exports: {} }
const code = ts.transpileModule(
  readFileSync(new URL('../../src/lib/featured-projects.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText
vm.runInNewContext(code, {
  module: loaded,
  exports: loaded.exports,
  require: (key) => {
    if (key === './project-visibility') return { availableProjectsWhere: {} }
    throw Error(`Unexpected import ${key}`)
  },
})
const { availableUnits, smallestUnit, unitSummary } = loaded.exports

// Shaped like Saima Elite Enclave: the cheapest row (2B1) is sold out.
const project = {
  unitTypes: [
    { name: 'Type XL', type: '4 Bed Drawing', rooms: 6, price: 42_400_000, areaSqFt: 2292 },
    { name: 'Type 1A1', type: '3 Bed Drawing', rooms: 5, price: 30_800_000, areaSqFt: 1665, soldOut: true },
    { name: 'Type 2B', type: '2 Bed DD / 3 Bed Lounge', rooms: 4, price: 25_000_000, areaSqFt: 1151 },
    { name: 'Type 2B1', type: '2 Bed Drawing', rooms: 4, price: 20_500_000, areaSqFt: 1108, soldOut: true },
  ],
}

test('sold-out units do not set the starting price or unit facts', () => {
  const s = unitSummary(project)
  assert.equal(s.count, 2)
  assert.equal(s.minPrice, 25_000_000)
  assert.equal(s.minArea, 1151)
  assert.ok(!s.types.includes('2 Bed Drawing'))
  assert.equal(smallestUnit(project).name, 'Type 2B')
})

test('a project with every unit sold out falls back to the full list', () => {
  const allGone = { unitTypes: project.unitTypes.map((u) => ({ ...u, soldOut: true })) }
  assert.equal(availableUnits(allGone).length, 4)
  assert.equal(unitSummary(allGone).minPrice, 20_500_000)
})
