import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function load(path, imports) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: (key) => imports[key] ?? require(key) })
  return module.exports
}
const helpers = load('../../src/lib/featured-projects.ts', { './project-visibility': { availableProjectsWhere: {} } })
const { UnitTypesTable } = load('../../src/components/projects/UnitTypesTable.tsx', {
  '@/lib/featured-projects': helpers,
  '@/lib/project-visibility': { hasPublicPaymentPlan: () => true },
  '@/components/landing/SectionRule': { SectionRule: () => null },
})
const unit = { type: '3 Bed Drawing', rooms: 5, price: 12000000 }
const render = (unitTypes) => renderToStaticMarkup(UnitTypesTable({ project: { title: 'Test', unitTypes }, showProse: false }))

test('omits an entirely blank area column from desktop headers and mobile cells', () => {
  const html = render([{ ...unit }, { ...unit, areaSqFt: null }])
  assert.doesNotMatch(html, />Area<|data-label="Area"/)
  assert.match(html, /data-label="Rooms"/)
  assert.match(html, /data-label="Price"/)
})

test('keeps partially filled columns, including values on sold-out units', () => {
  const html = render([{ ...unit }, { ...unit, areaSqFt: 1250, soldOut: true }])
  assert.match(html, />Area</)
  assert.equal((html.match(/data-label="Area"/g) || []).length, 2)
  assert.match(html, /1,250 sq ft/)
  assert.match(html, /—/)
})

test('zero is a value, and an empty action column is omitted', () => {
  const html = render([{ ...unit, areaSqFt: 0, soldOut: true }])
  assert.match(html, /0 sq ft/)
  assert.doesNotMatch(html, />Flat layout</)
})

test('omits other details when every row is blank', () => {
  const html = render([{ name: '  ', type: '', rooms: null, price: null }])
  assert.doesNotMatch(html, /data-label="(?:Unit|Configuration|Rooms|Price)"/)
})

test('retains layout and payment links when they provide an action', () => {
  assert.match(render([{ ...unit, soldOut: true, flatLayout: { url: '/layout.png' } }]), /href="\/layout.png"/)
  assert.match(render([unit]), />Payment plan</)
})
