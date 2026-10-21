import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, deps) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    process,
    require: (name) => {
      if (!(name in deps)) throw Error(name)
      return deps[name]
    },
  })
  return module.exports
}

const leadStatus = load('src/lib/lead-status.ts', {})

// Runs the hook for one status change and returns the Meta event sent, if any.
async function eventFor(prev, now) {
  const sent = []
  let resolveDone
  const done = new Promise((r) => (resolveDone = r))
  const { leadAfterChange } = load('src/collections/Leads/hooks/leadAfterChange.ts', {
    '@/lib/lead-status': leadStatus,
    '@/lib/meta-capi': {
      sendCapiEvent: async (opts) => {
        sent.push(opts.eventName)
        return { ok: true, status: 'sent' }
      },
    },
  })
  leadAfterChange({
    doc: { id: 1, status: now },
    previousDoc: { id: 1, status: prev },
    operation: 'update',
    context: {},
    req: { payload: { update: async () => resolveDone(), logger: { warn: () => {} } } },
  })
  await Promise.race([done, new Promise((r) => setTimeout(r, 50))])
  return sent[0] ?? null
}

test('qualified, site visited and closed won report QualifiedLead once', async () => {
  assert.equal(await eventFor('contacted', 'qualified'), 'QualifiedLead')
  assert.equal(await eventFor('engaged', 'site-visit'), 'QualifiedLead')
  assert.equal(await eventFor('unqualified', 'closed-won'), 'QualifiedLead')
  assert.equal(await eventFor('qualified', 'site-visit'), null)
  assert.equal(await eventFor('site-visit', 'closed-won'), null)
  assert.equal(await eventFor('junk', 'qualified'), 'QualifiedLead')
})

test('only Invalid / Junk reports DisqualifiedLead; Not a Fit is silent', async () => {
  assert.equal(await eventFor('contacted', 'junk'), 'DisqualifiedLead')
  assert.equal(await eventFor('contacted', 'not-a-fit'), null)
  assert.equal(await eventFor('qualified', 'not-a-fit'), null)
})

test('early stages send nothing', async () => {
  for (const [prev, now] of [
    ['unqualified', 'contacted'],
    ['contacted', 'details-sent'],
    ['details-sent', 'engaged'],
  ]) {
    assert.equal(await eventFor(prev, now), null)
  }
})
