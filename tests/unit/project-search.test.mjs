import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(file, deps = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      if (!(name in deps)) throw Error(name)
      return deps[name]
    },
    console,
    structuredClone,
    Date,
  })
  return module.exports
}
const budgets = load('src/lib/project-budgets.ts')
const visibility = load('src/lib/project-visibility.ts')
const search = load('src/lib/property-search.ts', {
  './project-budgets': budgets,
  './project-visibility': visibility,
})
test('each budget boundary belongs to exactly one range', () => {
  for (const [price, expected] of [
    [14999999, 'under-15m'],
    [15000000, '15m-25m'],
    [24999999, '15m-25m'],
    [25000000, '25m-50m'],
    [49999999, '25m-50m'],
    [50000000, '50m-plus'],
  ]) {
    assert.deepEqual(
      Array.from(
        budgets.PROJECT_BUDGETS.filter((b) => budgets.priceMatchesBudget(price, b.value)),
        (b) => b.value,
      ),
      [expected],
    )
  }
})
test('budget and unit configuration must match the same available unit; project minimum cannot hide a matching larger unit', () => {
  const project = {
    startingPrice: 12000000,
    unitTypes: [
      { type: '2 Bed Lounge', price: 12000000 },
      { type: '4 Bed Drawing', price: 30000000, isDuplex: true },
    ],
  }
  assert.equal(search.projectMatchesFilters(project, { budget: '25m-50m' }), true)
  assert.equal(
    search.projectMatchesFilters(project, { budget: 'under-15m', unitType: '4 Bed Drawing' }),
    false,
  )
  assert.equal(search.projectMatchesFilters(project, { budget: '25m-50m', layout: 'duplex' }), true)
  assert.equal(
    search.projectMatchesFilters(project, { budget: 'under-15m', layout: 'duplex' }),
    false,
  )
  assert.equal(
    search.projectMatchesFilters({ startingPrice: 15000000 }, { budget: 'under-15m' }),
    false,
  )
  assert.equal(search.projectMatchesFilters({}, { budget: 'under-15m' }), false)
  assert.equal(
    search.projectMatchesFilters(project, { minPrice: 12000000, maxPrice: 12000000 }),
    true,
  )
})
test('public search queries only project inventory and preserves Ready compatibility', async () => {
  let query
  const payload = {
    find: async (options) => {
      query = options
      return { docs: [] }
    },
  }
  await search.fetchUnified(
    payload,
    search.parseSearchParams({ status: 'Ready', budget: 'under-15m' }),
  )
  assert.equal(query.collection, 'featured-projects')
  assert.equal(query.overrideAccess, false)
  assert.ok(query.where.and.some((w) => w.status?.equals === 'Ready to Move'))
})
const blogs = load('src/lib/blogs.ts', {
  './project-visibility': visibility,
  '@/lib/project-mapper': { PROJECT_ENTITIES: [] },
  '@/lib/lexical-to-text': {},
})
test('editorial timestamps use Karachi and date-only values retain their day', () => {
  assert.equal(blogs.formatBlogDate('2026-08-31T19:00:00.000Z'), '1 Sept 2026')
  assert.equal(blogs.formatBlogDate('2026-08-31'), '31 Aug 2026')
  assert.equal(blogs.formatBlogDate('bad-date'), '')
})
const edits = JSON.parse(
  readFileSync(
    new URL('../../src/migrations/data/project-marketing-blog-edits.json', import.meta.url),
    'utf8',
  ),
)
const migration = load('src/migrations/20261008_000001_project_marketing_content.ts', {
  '@payloadcms/db-postgres': {},
  './data/project-marketing-blog-edits.json': edits,
  './data/project-marketing-article': {},
})
test('editorial migration changes only exact approved text and unwraps retired links without dropping educational text', () => {
  const original = {
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'An educational discussion of rental yield and future resale.' },
          {
            type: 'link',
            fields: { url: '/listings/retired' },
            children: [{ type: 'text', text: 'Historical example' }],
          },
          { type: 'text', text: 'Old service CTA' },
        ],
      },
    ],
  }
  const plan = {
    replacements: [{ before: 'Old service CTA', after: 'Explore Projects' }],
    unlinkListings: true,
  }
  const revised = migration.updateArticle(original, plan)
  assert.equal(revised.children[0].children[0].text, original.children[0].children[0].text)
  assert.equal(revised.children[0].children[1].text, 'Historical example')
  assert.equal(revised.children[0].children[2].text, 'Explore Projects')
  assert.equal(original.children[0].children[2].text, 'Old service CTA')
  assert.deepEqual(migration.updateArticle(revised, plan), revised)
})
