import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

test('immediate reopens alert even with legacy cooldown settings, while first receipt is preserved', async () => {
  let opens = 0
  const alerts = []
  const updates = []
  const payload = {
    find: async () => ({ docs: [{ id: 1, name: 'Test Buyer', sourceName: 'Test Project' }] }),
    count: async () => ({ totalDocs: opens }),
    create: async ({ data }) => { if (data.asset === 'page') opens++ },
    update: async (value) => { updates.push(value) },
  }
  const deps = {
    payload: { getPayload: async () => payload },
    '@payload-config': {},
    '@/lib/crm-push': { sendCrmPush: async (_payload, value) => { alerts.push(value) } },
    '@/utilities/getURL': { getServerSideURL: () => 'https://example.test' },
    '@/lib/lead-auto-status': { advanceLeadStatus: async () => {} },
  }
  const module = { exports: {} }
  const code = ts.transpileModule(
    readFileSync(new URL('../../src/lib/brochure-open.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText
  vm.runInNewContext(code, {
    module, exports: module.exports, console,
    process: { env: { CRM_PUSH_DISABLED: 'false', BROCHURE_REOPEN_COOLDOWN_MINUTES: '30', BROCHURE_REOPEN_COOLDOWN_HOURS: '2' } },
    require: (key) => { if (!(key in deps)) throw Error(key); return deps[key] },
  })
  const { logBrochureOpen } = module.exports
  for (let i = 0; i < 3; i++) await logBrochureOpen({ brochureId: 'test', asset: 'page' })
  assert.equal(opens, 3)
  assert.deepEqual(alerts.map((a) => a.title), ['Brochure Opened', 'Brochure Re-opened', 'Brochure Re-opened'])
  assert.equal(updates.length, 1)
  for (const asset of ['pdf1', 'pdf2', 'map', 'video']) await logBrochureOpen({ brochureId: 'test', asset })
  assert.equal(alerts.length, 3, 'Asset beacons must not duplicate the page-open notification')
})
