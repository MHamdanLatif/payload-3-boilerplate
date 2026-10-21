import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(file, deps = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console,
    require: (key) => {
      if (!(key in deps)) throw Error('Unexpected import ' + key)
      return deps[key]
    },
  })
  return module.exports
}
const report = load('src/lib/lead-report.ts', {
  '@payloadcms/db-postgres': { sql: () => '' },
})

test('report dates accept only real YYYY-MM-DD calendar dates', () => {
  assert.equal(report.reportDate('2026-10-21'), '2026-10-21')
  assert.equal(report.reportDate('2024-02-29'), '2024-02-29')
  for (const bad of ['abc', '2026-02-30', '2026-13-01', '2026-1-01', '', null, undefined, ['2026-10-01']])
    assert.equal(report.reportDate(bad), undefined)
})

test('report range uses PKT day bounds and ignores invalid dates instead of throwing', () => {
  const r = report.reportRange('2026-10-01', '2026-10-31')
  assert.equal(r.start, '2026-09-30T19:00:00.000Z')
  assert.equal(r.end, '2026-10-31T18:59:59.999Z')
  const bad = report.reportRange('abc', '2026-02-30')
  assert.equal(bad.start, undefined)
  assert.equal(bad.end, undefined)
  assert.equal(JSON.stringify(report.leadReportWhere(bad, undefined)), '{}')
  assert.equal(
    JSON.stringify(report.leadReportWhere(r, 'qualified')),
    JSON.stringify({
      and: [
        { createdAt: { greater_than_equal: r.start } },
        { createdAt: { less_than_equal: r.end } },
        { status: { equals: 'qualified' } },
      ],
    }),
  )
})

test('CSV cells neutralise formulas and keep RFC 4180 quoting', () => {
  assert.equal(report.csvCell(null), '')
  assert.equal(report.csvCell('Ali'), 'Ali')
  assert.equal(report.csvCell(0), '0')
  assert.equal(report.csvCell('a,b'), '"a,b"')
  assert.equal(report.csvCell('say "hi"'), '"say ""hi"""')
  for (const danger of ['=HYPERLINK("x")', '+1', '-1+2', '@SUM(A1)', '\tx', '\rx'])
    assert.ok(report.csvCell(danger).replace(/^"/, '').startsWith("'"), danger)
  assert.equal(report.csvCell('=1+1'), "'=1+1")
  assert.equal(report.csvCell('=A1,B1'), `"'=A1,B1"`)
  assert.equal(report.csvCell('علی'), 'علی')
})

test('phone numbers export as text so the + and leading zeros survive', () => {
  assert.equal(report.csvText('+923001234567'), "'+923001234567")
  assert.equal(report.csvText('03001234567'), "'03001234567")
  assert.equal(report.csvText("'+92300"), "'+92300")
  assert.equal(report.csvText(null), '')
  assert.equal(report.csvText(''), '')
})

test('timestamps format as Pakistan time', () => {
  assert.equal(report.pktDateTime('2026-10-04T20:30:00.000Z'), '2026-10-05 01:30')
  assert.equal(report.pktDateTime(new Date('2026-10-21T00:00:00Z')), '2026-10-21 05:00')
  assert.equal(report.pktDateTime(null), '')
  assert.equal(report.pktDateTime('not a date'), '')
})
