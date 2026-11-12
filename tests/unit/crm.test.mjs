import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
function load(file, deps = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console,
    URL,
    require: (key) => {
      if (!(key in deps)) throw Error('Unexpected import ' + key)
      return deps[key]
    },
  })
  return module.exports
}
const input = load('src/lib/crm-input.ts', { 'libphonenumber-js': { parsePhoneNumberFromString } })
const statuses = load('src/lib/lead-status.ts')

test('manual project options show linked projects once and preserve standalone pages', async () => {
  const payload = {
    auth: async () => ({ user: { id: 1 } }),
    find: async ({ collection, select, overrideAccess }) => {
      assert.equal(overrideAccess, false)
      if (collection === 'featured-projects')
        return { docs: [{ id: 5, title: 'Featured project' }] }
      assert.equal(select.linkedProject, true)
      return { docs: [
        { id: 10, title: 'Featured project', linkedProject: 5 },
        { id: 11, title: 'Another campaign for same project', linkedProject: { id: 5 } },
        { id: 5, title: 'Saima Prestige Park', linkedProject: null },
        { id: 12, title: 'Unavailable featured listing', linkedProject: 99 },
      ] }
    },
  }
  const server = load('src/lib/crm-server.ts', {
    'next/headers': { headers: async () => ({}) },
    'next/navigation': { redirect: () => { throw Error('Unexpected redirect') } },
    payload: { getPayload: async () => payload },
    '@payload-config': {},
  })
  const options = await server.crmManualProjects()
  assert.deepEqual(JSON.parse(JSON.stringify(options)), [
    { id: '5', title: 'Featured project' },
    { id: 'marketed:5', title: 'Saima Prestige Park' },
    { id: 'marketed:12', title: 'Unavailable featured listing' },
  ])
})
test('manual entry normalizes phones and derives source/project attribution', () => {
  assert.equal(input.contactInput({ name: ' Ali ', phone: '03001234567' }).phone, '+923001234567')
  assert.equal(input.contactInput({ name: ' Ali ', phone: '03001234567' }).name, 'Ali')
  for (const source of ['whatsapp', 'call', 'referral']) {
    const data = input.manualAttribution(source, { id: 5, title: 'Tulip', slug: 'tulip' })
    assert.equal(data.sourceSlug, 'tulip')
    assert.equal(data.source, source)
    assert.equal(data.acquisitionSource, source === 'call' ? 'manual' : source)
    assert.equal(data.conversionSurface, 'crm-manual')
    assert.equal(data.acquiredProject, 5)
  }
  assert.throws(() => input.contactInput({ name: '', phone: '123' }))
  assert.throws(() => input.contactInput({ name: 'Ali', phone: '123' }))
  assert.throws(() => input.manualAttribution('meta-ads', { id: 5 }))
  assert.throws(() => input.projectId(-1))
})
function fixture(authenticated = true) {
  const writes = []
  const payload = {
    auth: async () => ({ user: authenticated ? { id: 1 } : null }),
    findByID: async ({ id, collection, overrideAccess, user }) => {
      assert.equal(overrideAccess, false)
      assert.equal(user.id, 1)
      if (Number(id) !== 5) throw Error('Project not found')
      if (collection === 'marketed-projects')
        return { id: 5, title: 'Saima Prestige Park', slug: 'saima-prestige-park' }
      return { id: 5, title: 'Tulip', slug: 'tulip' }
    },
    create: async (args) => {
      writes.push(args)
      return { id: 8 }
    },
    update: async (args) => {
      writes.push(args)
      return { id: 8 }
    },
  }
  const deps = {
    'next/server': {
      NextResponse: {
        json: (data, opts) => new Response(JSON.stringify(data), { status: opts?.status || 200 }),
      },
    },
    payload: { getPayload: async () => payload },
    '@payload-config': {},
    '@/lib/crm-input': input,
    '@/lib/lead-status': statuses,
    '@/utilities/getURL': { getServerSideURL: () => 'https://crm.test' },
    '@/access/finance': { hasFinanceAccess: (user) => user?.financeAccess === true },
    '@/lib/finance-query': { rupees: (n) => `Rs. ${n}` },
    '@/collections/Leads/hooks/guardLeadDelete': { CRM_LEAD_DELETE: 'crmLeadDelete' },
    // Repeat-enquiry warnings are covered in finance-funding.test.mjs and the e2e suite.
    '@/lib/phone-key': { phoneKey: () => null },
    '@/lib/lead-duplicates': { leadsWithPhoneKey: async () => [] },
  }
  return {
    writes,
    post: load('src/app/api/crm/leads/route.ts', deps).POST,
    patch: load('src/app/api/crm/leads/[id]/route.ts', deps).PATCH,
  }
}
const request = (body, origin = 'https://crm.test') =>
  new Request('https://crm.test/api/crm/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  })
const body = { name: 'Ali', phone: '03001234567', project: 5, source: 'call' }
test('anonymous and cross-origin writes are refused', async () => {
  for (const method of ['post', 'patch']) {
    assert.equal(
      (await fixture(false)[method](request(body), { params: Promise.resolve({ id: '8' }) }))
        .status,
      401,
    )
    for (const origin of [null, 'https://evil.test'])
      assert.equal(
        (await fixture()[method](request(body, origin), { params: Promise.resolve({ id: '8' }) }))
          .status,
        403,
      )
  }
})
test('create fills hidden fields server-side and checks Payload access', async () => {
  const f = fixture()
  assert.equal(
    (await f.post(request({ ...body, acquiredProject: 99, conversionSurface: 'meta' }))).status,
    201,
  )
  assert.equal(f.writes[0].overrideAccess, false)
  assert.equal(f.writes[0].user.id, 1)
  assert.equal(f.writes[0].data.acquiredProject, 5)
  assert.equal(f.writes[0].data.conversionSurface, 'crm-manual')
  assert.equal(f.writes[0].data.phone, '+923001234567')
})
test('invalid projects and source values never create a lead', async () => {
  const f = fixture()
  for (const data of [
    { ...body, project: 99 },
    { ...body, source: 'ad' },
    { ...body, project: '' },
    { ...body, project: 'marketed:99' },
    { ...body, project: 'marketed:0' },
    { ...body, project: 'marketed:5:6' },
    null,
  ])
    assert.equal((await f.post(request(data))).status, 400)
  assert.equal(f.writes.length, 0)
})

test('manual marketed leads keep their identity even when featured IDs collide', async () => {
  const f = fixture()
  const response = await f.post(request({ ...body, project: 'marketed:5', source: 'whatsapp' }))
  assert.equal(response.status, 201)
  const data = f.writes[0].data
  assert.equal(data.marketedProject, 5)
  assert.equal(data.sourceKind, 'marketed-project')
  assert.equal(data.sourceName, 'Saima Prestige Park')
  assert.equal(data.sourceSlug, 'saima-prestige-park')
  assert.equal(data.acquiredProject, undefined)
  assert.equal(data.currentInterestedProject, undefined)
  assert.equal(data.acquisitionSource, 'whatsapp')
  assert.equal(data.conversionSurface, 'crm-manual')
  for (const linkedProject of [9, { id: 9 }]) {
    const linked = input.manualAttribution('call', {
      id: 5, title: 'Marketing page', linkedProject,
    }, 'marketed-project')
    assert.equal(linked.marketedProject, 5)
    assert.equal(linked.acquiredProject, 9)
    assert.equal(linked.currentInterestedProject, 9)
  }
})
test('editing allows contact/status/closing details but never rewrites acquisition', async () => {
  const f = fixture()
  const result = await f.patch(
    request({
      name: 'Updated',
      phone: '03007654321',
      status: 'closed-won',
      closedProject: 5,
      acquiredProject: 99,
      sourceSlug: 'overwrite',
      brochureId: 'overwrite',
    }),
    { params: Promise.resolve({ id: '8' }) },
  )
  assert.equal(result.status, 200)
  const data = f.writes[0].data
  assert.equal(data.status, 'closed-won')
  assert.equal(data.closedProject, 5)
  assert.equal(data.acquiredProject, undefined)
  assert.equal(data.sourceSlug, undefined)
  assert.equal(data.brochureId, undefined)
  assert.equal(f.writes[0].overrideAccess, false)
  assert.equal(
    (await f.patch(request({ status: 'made-up' }), { params: Promise.resolve({ id: '8' }) }))
      .status,
    400,
  )
})
