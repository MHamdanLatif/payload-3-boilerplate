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
const g = load('src/lib/lead-report-groups.ts', {
  './lead-status': load('src/lib/lead-status.ts'),
})
const report = load('src/lib/lead-report.ts', { '@payloadcms/db-postgres': { sql: () => '' } })

// vm-loaded values come from another realm, so compare their JSON.
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b))

const projects = [
  { id: 1, title: 'Tulip Comforts', slug: 'tulip-comforts' },
  { id: 2, title: 'Saima Elite Enclave', slug: 'saima-elite-enclave' },
]
const marketed = [{ id: 9, slug: 'tulip-offer', linkedProject: 1 }]

test('leads group under the project that acquired them, then general, then old listings', () => {
  const key = (l) => g.reportProjectKey(l, projects, marketed)
  assert.equal(key({ acquiredProject: 2, currentInterestedProject: 1 }), 'p:2')
  assert.equal(key({ marketedProject: 9 }), 'p:1')
  assert.equal(key({ sourceKind: 'marketed-project', sourceSlug: 'tulip-offer' }), 'p:1')
  assert.equal(key({ sourceKind: 'project', sourceSlug: 'saima-elite-enclave' }), 'p:2')
  assert.equal(key({ sourceKind: 'meta-ad', sourceName: 'tulip comforts' }), 'p:1')
  assert.equal(key({ sourceKind: 'listing', sourceName: '4 bed flat' }), 'other')
  assert.equal(key({ source: 'listing-landing:hero' }), 'other')
  assert.equal(key({ sourceKind: 'project', sourceSlug: 'deleted-project' }), 'other')
  assert.equal(key({ sourceKind: 'consultation' }), 'general')
  assert.equal(key({}), 'general')
  same(
    g.projectOptions(projects).map((o) => o.value),
    ['p:1', 'p:2', 'general', 'other'],
  )
})

test('sources: Meta down to the ad, Google split by kind, people referrals apart from websites', () => {
  const meta = {
    acquisitionSource: 'meta-ads',
    firstTouchCampaign: 'Tulip Oct',
    firstTouchTerm: 'Karachi 25-45',
    firstTouchContent: 'Video A',
  }
  same(g.sourcePath(meta), ['Meta paid ads', 'Tulip Oct', 'Karachi 25-45', 'Video A'])
  same(g.sourcePath({ sourceKind: 'meta-ad', metaAdName: 'Form ad' }), [
    'Meta paid ads',
    'Campaign not recorded',
    'Ad set not recorded',
    'Form ad',
  ])
  same(g.sourcePath({ acquisitionSource: 'google-organic' }), [
    'Google search & website',
    'Organic search (SEO)',
  ])
  same(g.sourcePath({ acquisitionSource: 'direct' }), [
    'Google search & website',
    'Direct website visit',
  ])
  assert.equal(
    g.channelOf({ acquisitionSource: 'referral', firstTouchReferrer: 'https://zameen.com/x' }),
    'google',
  )
  assert.equal(g.channelOf({ acquisitionSource: 'referral', conversionSurface: 'crm-manual' }), 'referral')
  assert.equal(g.channelOf({ acquisitionSource: 'whatsapp' }), 'whatsapp')
  same(g.sourcePath({ source: 'call', acquisitionSource: 'manual' }), ['Other', 'Phone call'])
  same(g.sourcePath({}), ['Other', 'Source not recorded'])
  // The form a lead used never appears in the report.
  assert.ok(!g.sourceSummary({ ...meta, conversionSurface: 'project-hero-form' }).includes('form'))
})

test('source rows nest under channels in a fixed order and count the funnel cumulatively', () => {
  const rows = g.sourceRows([
    { acquisitionSource: 'whatsapp', status: 'closed-won' },
    { acquisitionSource: 'meta-ads', firstTouchCampaign: 'C1', firstTouchTerm: 'S1', firstTouchContent: 'A1', status: 'qualified' },
    { acquisitionSource: 'meta-ads', firstTouchCampaign: 'C1', firstTouchTerm: 'S1', firstTouchContent: 'A2', status: 'junk' },
  ])
  same(
    rows.map((r) => [r.depth, r.label, r.counts.leads]),
    [
      [0, 'Meta paid ads', 2],
      [1, 'C1', 2],
      [2, 'S1', 2],
      [3, 'A1', 1],
      [3, 'A2', 1],
      [0, 'WhatsApp', 1],
    ],
  )
  const wa = rows.at(-1).counts
  assert.equal(wa.qualified, 1)
  assert.equal(wa.siteVisits, 1)
  assert.equal(wa.closedWon, 1)
  assert.equal(rows[0].counts.junk, 1)
  assert.equal(rows[0].counts.contacted, 2)
})

test('period presets are PKT calendar ranges; weeks start Monday', () => {
  // Thu 30 Oct 2026, 21:00 UTC = Fri 31 Oct 02:00 PKT
  const now = new Date('2026-10-30T21:00:00Z')
  same(g.periodDates('today', now), { from: '2026-10-31', to: '2026-10-31' })
  same(g.periodDates('yesterday', now), { from: '2026-10-30', to: '2026-10-30' })
  same(g.periodDates('7d', now), { from: '2026-10-25', to: '2026-10-31' })
  same(g.periodDates('week', now), { from: '2026-10-26', to: '2026-10-31' })
  same(g.periodDates('month', now), { from: '2026-10-01', to: '2026-10-31' })
  same(g.periodDates('last-month', now), { from: '2026-09-01', to: '2026-09-30' })
  assert.equal(g.periodDates('custom', now), null)
  assert.equal(g.periodDates('all', now), null)
})

test('custom ranges accept a PKT time, inclusive to the end of that minute', () => {
  const r = report.reportRange('2026-10-01T09:30', '2026-10-01T18:00')
  assert.equal(r.start, '2026-10-01T04:30:00.000Z')
  assert.equal(r.end, '2026-10-01T13:00:59.999Z')
  for (const bad of ['2026-10-01T24:00', '2026-10-01T9:30', '2026-02-30T10:00'])
    assert.equal(report.reportDateTime(bad), undefined)
})
