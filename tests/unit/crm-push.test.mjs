import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createHash } from 'node:crypto'

function load(path, deps, globals = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    URL,
    console,
    process: { env: {} },
    setTimeout: (fn) => {
      fn()
      return 0
    },
    require: (name) => {
      if (!(name in deps)) throw Error(name)
      return deps[name]
    },
    ...globals,
  })
  return module.exports
}
const endpoint = 'https://fcm.googleapis.com/fcm/send/test-device'
const subscription = { endpoint, keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } }
function sender({ docs = [], disabled = false, failure } = {}) {
  const sends = [],
    deletes = []
  const push = load(
    'src/lib/crm-push.ts',
    {
      'node:crypto': { createHash },
      '@payloadcms/db-postgres': { sql: (parts, ...values) => ({ text: parts.join('?'), values }) },
      '@/utilities/getURL': { getServerSideURL: () => 'https://crm.test' },
      'web-push': {
        generateVAPIDKeys: () => ({ publicKey: 'public', privateKey: 'private' }),
        sendNotification: async (...args) => {
          sends.push(args)
          if (failure) throw Object.assign(Error('failed'), { statusCode: failure })
        },
      },
    },
    { process: { env: { CRM_PUSH_DISABLED: disabled ? 'true' : 'false' } } },
  )
  const payload = {
    find: async () => ({ docs }),
    delete: async (data) => {
      deletes.push(data)
    },
    db: {
      drizzle: {
        execute: async () => ({ rows: [{ public_key: 'public', private_key: 'private' }] }),
      },
    },
    logger: { warn: () => {} },
  }
  return { push, payload, sends, deletes }
}
test('push rejects arbitrary URLs and malformed browser subscription keys', () => {
  const { push } = sender()
  for (const bad of [
    'http://fcm.googleapis.com/a',
    'https://localhost/x',
    'https://fcm.googleapis.com.evil.test/x',
    'https://user@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:444/x',
  ])
    assert.equal(push.validPushEndpoint(bad), false)
  assert.equal(push.parseSubscription(subscription).endpoint, endpoint)
  assert.throws(() => push.parseSubscription({ ...subscription, keys: { auth: 'x', p256dh: 'y' } }))
})
test('disabled delivery and no devices do not report success', async () => {
  for (const disabled of [true, false]) {
    const f = sender({ disabled })
    assert.equal(
      (await f.push.sendCrmPush(f.payload, { title: 'New lead', message: 'Test' })).ok,
      false,
    )
    assert.equal(f.sends.length, 0)
  }
})
test('delivery keeps brochure action and prunes expired subscriptions', async () => {
  const docs = [{ id: 1, owner: 7, endpoint, ...subscription.keys }]
  const message = {
    title: 'New Lead',
    message: 'Ali',
    actions: [
      {
        action: 'send-brochure',
        title: 'Send brochure',
        url: 'https://crm.test/api/leads/12/send-brochure?sig=test',
      },
    ],
  }
  const ok = sender({ docs })
  assert.equal((await ok.push.sendCrmPush(ok.payload, message)).ok, true)
  assert.deepEqual(JSON.parse(ok.sends[0][1]).actions, message.actions)
  assert.equal(ok.sends[0][2].vapidDetails.privateKey, 'private')
  assert.ok(!ok.sends[0][1].includes('private'))
  const expired = sender({ docs, failure: 410 })
  assert.equal((await expired.push.sendCrmPush(expired.payload, message)).ok, false)
  assert.equal(expired.deletes[0].id, 1)
  assert.equal(expired.sends.length, 1)
  const transient = sender({ docs, failure: 503 })
  assert.equal((await transient.push.sendCrmPush(transient.payload, message)).ok, false)
  assert.equal(transient.sends.length, 3)
  assert.equal(transient.deletes.length, 0)
})
function api({ user = { id: 1 }, owner, disabled = false } = {}) {
  const f = sender({ disabled }),
    writes = [],
    sends = []
  const payload = {
    auth: async () => ({ user }),
    find: async () => ({ docs: owner ? [{ id: 2, owner }] : [] }),
    create: async (v) => writes.push(v),
    update: async (v) => writes.push(v),
    delete: async (v) => writes.push(v),
  }
  const route = load('src/app/api/crm/push/route.ts', {
    'next/server': { NextResponse: { json: (body, opts = {}) => Response.json(body, opts) } },
    payload: { getPayload: async () => payload },
    '@payload-config': {},
    '@/utilities/getURL': { getServerSideURL: () => 'https://crm.test' },
    '@/lib/crm-push': {
      ...f.push,
      getPushKeys: async () => ({ publicKey: 'public', privateKey: 'secret' }),
      sendCrmPush: async (...args) => {
        sends.push(args)
        return { ok: true }
      },
    },
  })
  const request = (method, body = subscription, origin = 'https://crm.test') =>
    new Request('https://crm.test/api/crm/push', {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    })
  return { route, request, writes, sends }
}
test('notification API requires login, same origin, and subscription ownership', async () => {
  const anon = api({ user: null })
  assert.equal((await anon.route.GET(anon.request('GET'))).status, 401)
  const own = api()
  assert.equal(
    (await own.route.POST(own.request('POST', subscription, 'https://evil.test'))).status,
    403,
  )
  assert.equal(own.writes.length, 0)
  const other = api({ owner: 9 })
  for (const method of ['POST', 'DELETE'])
    assert.equal((await other.route[method](other.request(method))).status, 409)
  assert.equal(other.writes.length, 0)
  assert.deepEqual(await (await own.route.GET(own.request('GET'))).json(), { publicKey: 'public' })
  assert.equal((await own.route.POST(own.request('POST'))).status, 200)
  assert.equal(own.writes[0].data.owner, 1)
})
test('test notification targets only the current device; deletion remains available when disabled', async () => {
  const f = api({ owner: 1 })
  assert.equal((await f.route.POST(f.request('POST', { endpoint, test: true }))).status, 200)
  assert.equal(f.sends[0][2].owner, 1)
  assert.equal(f.sends[0][2].endpointHash, createHash('sha256').update(endpoint).digest('hex'))
  const disabled = api({ owner: 1, disabled: true })
  assert.equal((await disabled.route.DELETE(disabled.request('DELETE'))).status, 200)
  assert.equal(disabled.writes[0].id, 2)
})
test('worker shows branded actions and opens the signed brochure URL, blocking external targets', async () => {
  const handlers = {},
    shown = [],
    opened = []
  const self = {
    location: { origin: 'https://crm.test' },
    addEventListener: (name, fn) => {
      handlers[name] = fn
    },
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) },
  }
  vm.runInNewContext(readFileSync('public/leads-dashboard/sw.js', 'utf8'), { self, URL })
  let pending
  const url = 'https://crm.test/api/leads/12/send-brochure?sig=test'
  handlers.push({
    data: {
      json: () => ({
        title: 'New Lead',
        body: 'Ali',
        url: '/leads-dashboard/12',
        actions: [{ action: 'send-brochure', title: 'Send brochure', url }],
      }),
    },
    waitUntil: (p) => {
      pending = p
    },
  })
  await pending
  assert.equal(shown[0][1].actions[0].title, 'Send brochure')
  assert.equal(shown[0][1].icon, '/leads-dashboard/icon-192.png?v=2')
  handlers.notificationclick({
    action: 'send-brochure',
    notification: { data: shown[0][1].data, close() {} },
    waitUntil: (p) => {
      pending = p
    },
  })
  await pending
  assert.equal(opened[0], url)
  handlers.notificationclick({
    notification: { data: { url: 'https://evil.test' }, close() {} },
    waitUntil: (p) => {
      pending = p
    },
  })
  await pending
  assert.equal(opened[1], 'https://crm.test/leads-dashboard')
})
