import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const module = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../../src/lib/recent-brochure-viewers.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  { module, exports: module.exports },
)
const { recentBrochureViewers } = module.exports

test('queries the full seven-day page-open window with access checks and groups legacy visits', async () => {
  const user = { id: 9 }
  const now = new Date('2026-10-02T12:00:00Z')
  const visits = [
    { id: 1, lead: 2, brochureId: 'b', dwellMs: null },
    { id: 2, lead: 1, brochureId: 'a', dwellMs: 10000 },
    { id: 3, lead: null, brochureId: 'b', dwellMs: 20000 },
    { id: 4, lead: 99, brochureId: 'deleted', dwellMs: 90000 },
    ...Array.from({ length: 20 }, (_, i) => ({
      id: i + 5,
      lead: 1,
      brochureId: 'a',
      dwellMs: 1000,
    })),
  ]
  let calls = 0
  const payload = {
    find: async (args) => {
      calls++
      assert.equal(args.overrideAccess, false)
      assert.equal(args.user, user)
      assert.equal(args.pagination, false)
      assert.equal(args.depth, 0)
      if (args.collection === 'link-opens') {
        assert.equal(args.sort, '-createdAt')
        assert.deepEqual(JSON.parse(JSON.stringify(args.where)), {
          and: [
            { asset: { equals: 'page' } },
            { createdAt: { greater_than_equal: '2026-09-25T12:00:00.000Z' } },
            { createdAt: { less_than_equal: '2026-10-02T12:00:00.000Z' } },
          ],
        })
        return { docs: visits }
      }
      return {
        docs: [
          { id: 1, brochureId: 'a' },
          { id: 2, brochureId: 'b' },
        ],
      }
    },
  }
  const result = await recentBrochureViewers(payload, user, now)
  assert.equal(calls, 2)
  assert.equal(result.length, 2)
  assert.equal(result[0].lead.id, 2)
  assert.equal(result[0].visits.length, 2)
  assert.equal(result[0].captured, 1)
  assert.equal(result[0].totalMs, 20000)
  assert.equal(result[1].visits.length, 21)
  assert.equal(result[1].totalMs, 30000)
})

test('no opens or unidentifiable opens return no viewers without a broad leads query', async () => {
  for (const docs of [[], [{ id: 1, lead: null, brochureId: null }]]) {
    let calls = 0
    const result = await recentBrochureViewers(
      {
        find: async () => {
          calls++
          return { docs }
        },
      },
      { id: 9 },
    )
    assert.equal(result.length, 0)
    assert.equal(calls, 1)
  }
})
