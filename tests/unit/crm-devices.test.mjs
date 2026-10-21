import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

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
    require: (name) => {
      if (!(name in deps)) throw Error(name)
      return deps[name]
    },
    ...globals,
  })
  return module.exports
}

class APIError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}
const devices = load('src/lib/crm-devices.ts', { payload: { APIError } })

const ua = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
}

test('phones and tablets are detected from the user agent; iPadOS via touch points', () => {
  assert.deepEqual({ ...devices.classifyDevice(ua.android) }, { mobile: true, description: 'Android phone · Chrome' })
  assert.equal(devices.classifyDevice(ua.androidTablet).description, 'Android tablet · Chrome')
  assert.equal(devices.classifyDevice(ua.iphone).description, 'iPhone · Safari')
  assert.equal(devices.classifyDevice(ua.mac, '5').description, 'iPad · Safari')
  assert.equal(devices.classifyDevice(ua.mac, '0').mobile, false)
  assert.equal(devices.classifyDevice(ua.mac).mobile, false)
  assert.equal(devices.classifyDevice(ua.windows).mobile, false)
  assert.equal(devices.classifyDevice(null).mobile, false)
})

const hour = 3600_000
const future = () => new Date(Date.now() + hour).toISOString()
function fixture(rows, user) {
  const state = { rows: [...rows], deleted: [], created: [], userUpdates: [], user }
  const payload = {
    find: async ({ where }) => ({
      docs: where.owner
        ? state.rows.filter((row) => row.owner === where.owner.equals)
        : state.rows.filter(
            (row) => row.id === where.and[0].id.equals && row.owner === where.and[1].owner.equals,
          ),
    }),
    delete: async ({ collection, where }) => {
      state.deleted.push({ collection, sessions: [...where.sessionId.in] })
      if (collection === 'crm-devices')
        state.rows = state.rows.filter((row) => !where.sessionId.in.includes(row.sessionId))
    },
    create: async ({ data }) => {
      state.created.push(data)
      state.rows.push({ id: 99, ...data })
    },
    db: {
      findOne: async () => state.user,
      updateOne: async (args) => state.userUpdates.push(args),
    },
  }
  return { state, payload }
}
const login = (payload, userAgent, sessions, touch) =>
  devices.limitMobileSessions({
    req: {
      payload,
      headers: new Headers({
        'user-agent': userAgent,
        ...(touch ? { 'x-crm-touch-points': touch } : {}),
      }),
    },
    user: { id: 1, sessions },
  })
const phones = [
  { id: 1, owner: 1, sessionId: 's1' },
  { id: 2, owner: 1, sessionId: 's2' },
  { id: 3, owner: 1, sessionId: 'expired' },
  { id: 4, owner: 2, sessionId: 'other-user' },
]
const sessions = (...ids) => [
  { id: 'expired', expiresAt: new Date(Date.now() - hour).toISOString() },
  ...ids.map((id) => ({ id, expiresAt: future() })),
]

test('a third phone/tablet sign-in is blocked with a clear message; expired slots are freed', async () => {
  const f = fixture(phones)
  await assert.rejects(login(f.payload, ua.iphone, sessions('s1', 's2', 'new')), (error) => {
    assert.equal(error.status, 403)
    assert.match(error.message, /already signed in on 2 phones\/tablets/)
    assert.match(error.message, /Signed-in devices/)
    return true
  })
  assert.equal(f.state.created.length, 0)
  // The expired session's device and its alerts are removed, never another user's.
  assert.deepEqual(
    f.state.deleted.map((d) => d.collection),
    ['crm-devices', 'push-subscriptions'],
  )
  assert.deepEqual(f.state.deleted[0].sessions, ['expired'])
  // iPadOS with a Mac user agent is counted too.
  await assert.rejects(login(f.payload, ua.mac, sessions('s1', 's2', 'new'), '5'))
})

test('laptops are never blocked or counted', async () => {
  const f = fixture(phones)
  await login(f.payload, ua.windows, sessions('s1', 's2', 'new'))
  await login(f.payload, ua.mac, sessions('s1', 's2', 'new'))
  assert.equal(f.state.created.length, 0)
})

test('a signed-out phone frees its slot and the new phone is recorded', async () => {
  const f = fixture(phones)
  await login(f.payload, ua.android, sessions('s2', 'new'))
  assert.deepEqual(f.state.deleted[0].sessions, ['s1', 'expired'])
  assert.deepEqual({ ...f.state.created[0] }, {
    sessionId: 'new',
    owner: 1,
    description: 'Android phone · Chrome',
  })
})

test('logout removes that session device and its push subscription', async () => {
  const f = fixture(phones)
  await devices.forgetLoggedOutSession({ req: { payload: f.payload, user: { id: 1, _sid: 's1' } } })
  assert.deepEqual(
    f.state.deleted.map((d) => [d.collection, d.sessions]),
    [
      ['crm-devices', ['s1']],
      ['push-subscriptions', ['s1']],
    ],
  )
})

test('users can sign out only their own devices; doing so ends that session and its alerts', async () => {
  const user = { id: 1, sessions: sessions('s1', 's2') }
  const f = fixture(phones, user)
  assert.equal(await devices.signOutDevice(f.payload, 1, 4), null)
  assert.equal(f.state.userUpdates.length, 0)
  assert.equal(f.state.deleted.length, 0)
  const device = await devices.signOutDevice(f.payload, 1, 1)
  assert.equal(device.sessionId, 's1')
  assert.deepEqual(
    f.state.userUpdates[0].data.sessions.map((s) => s.id),
    ['expired', 's2'],
  )
  assert.deepEqual(f.state.deleted.at(-1), { collection: 'push-subscriptions', sessions: ['s1'] })
})

function markContacted({ user = { id: 1 }, status = 'unqualified' } = {}) {
  const updates = []
  const route = load('src/app/api/leads/[id]/mark-contacted/route.ts', {
    'next/server': { NextResponse: { json: (body, opts = {}) => Response.json(body, opts) } },
    payload: {
      getPayload: async () => ({
        auth: async () => ({ user }),
        findByID: async () => ({ id: 7, status }),
        update: async (args) => {
          updates.push(args)
          return { status: args.data.status ?? status }
        },
      }),
    },
    '@payload-config': {},
    '@/utilities/getURL': { getServerSideURL: () => 'https://crm.test' },
  }, { Response })
  const call = (origin = 'https://crm.test') =>
    route.POST(
      new Request('https://crm.test/api/leads/7/mark-contacted', {
        method: 'POST',
        headers: { Origin: origin },
      }),
      { params: Promise.resolve({ id: '7' }) },
    )
  return { call, updates }
}

test('Mark contacted clears the reminder and only ever moves status forward', async () => {
  for (const status of ['unqualified']) {
    const f = markContacted({ status })
    assert.equal((await f.call()).status, 200)
    assert.deepEqual({ ...f.updates[0].data }, { followUpAt: null, status: 'contacted' })
    assert.equal(f.updates[0].overrideAccess, false)
  }
  for (const status of ['contacted', 'details-sent', 'engaged', 'qualified', 'closed-won', 'not-a-fit', 'junk']) {
    const f = markContacted({ status })
    await f.call()
    assert.deepEqual({ ...f.updates[0].data }, { followUpAt: null })
  }
  assert.equal((await markContacted({ user: null }).call()).status, 401)
  const evil = markContacted()
  assert.equal((await evil.call('https://evil.test')).status, 403)
  assert.equal(evil.updates.length, 0)
})
