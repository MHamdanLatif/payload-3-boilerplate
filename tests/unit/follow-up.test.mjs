import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, deps) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console,
    require: (key) => {
      if (!(key in deps)) throw Error(`Unexpected import ${key}`)
      return deps[key]
    },
  })
  return module.exports
}

const { prepareFollowUp } = load('src/collections/Leads/hooks/prepareFollowUp.ts', {
  payload: { ValidationError: class extends Error {} },
})
const future = () => new Date(Date.now() + 86400000).toISOString()

test('new leads default to no reminder; notes-only changes leave scheduling untouched', () => {
  const data = { conversationNotes: 'Discuss pricing' }
  assert.equal(prepareFollowUp({ data }), data)
  assert.equal(data.followUpAt, undefined)
})

test('scheduling, rescheduling and cancellation reset prior delivery and leases', () => {
  for (const date of [future(), null]) {
    const data = { followUpAt: date }
    prepareFollowUp({
      data,
      originalDoc: { followUpAt: '2020-01-01T00:00:00Z', followUpSentAt: '2020-01-01T00:01:00Z' },
    })
    assert.equal(data.followUpSentAt, null)
    assert.equal(data.followUpRepeatSentAt, null)
    assert.equal(data.followUpClaim, null)
    assert.equal(data.followUpRetryAt, null)
    assert.equal(data.followUpStatus, date ? 'Pending' : null)
  }
})

test('invalid and past reminders are rejected, but unchanged overdue dates allow editing notes', () => {
  for (const followUpAt of ['invalid', '2020-01-01T00:00:00Z']) {
    assert.throws(() => prepareFollowUp({ data: { followUpAt } }))
  }
  const data = { followUpAt: '2020-01-01T00:00:00Z', conversationNotes: 'Updated' }
  prepareFollowUp({ data, originalDoc: { followUpAt: data.followUpAt } })
  assert.equal(data.followUpSentAt, undefined)
})

function deliveryFixture({
  configured = true,
  result = { ok: true, status: '200' },
  cancelled = false,
  sentAt = null,
  onSend,
} = {}) {
  const calls = [],
    messages = []
  const { deliverFollowUpReminders } = load('src/lib/follow-up-reminders.ts', {
    './lead-labels': load('src/lib/lead-labels.ts', {}),
    'node:crypto': { randomUUID: () => 'lease-123' },
    '@payloadcms/db-postgres': { sql: (parts, ...values) => ({ text: parts.join('?'), values }) },
    './lead-notification-queue': { deliverLeadNotifications: async () => {} },
    './crm-push': {
      crmPushConfigured: () => configured,
      sendCrmPush: async (_payload, message) => {
        messages.push(message)
        onSend?.()
        return result
      },
    },
    '@/utilities/getURL': { getServerSideURL: () => 'https://example.com' },
  })
  const payload = {
    db: {
      drizzle: {
        execute: async (query) => {
          calls.push(query)
          // Call 0 closes expired retries, call 1 claims, call 2 records the result.
          return { rows: calls.length === 2 ? [{ id: 12 }] : [] }
        },
      },
    },
    findByID: async () => ({
      id: 12,
      name: 'Client',
      phone: '03001234567',
      followUpAt: '2026-01-01T00:00:00Z',
      followUpSentAt: sentAt,
      followUpClaim: cancelled ? null : 'lease-123',
    }),
  }
  return { run: () => deliverFollowUpReminders(payload), calls, messages }
}

test('disabled CRM push leaves due reminders pending without claiming them', async () => {
  const fixture = deliveryFixture({ configured: false })
  await fixture.run()
  assert.equal(fixture.calls.length, 0)
  assert.equal(fixture.messages.length, 0)
})

test('successful delivery links to the client and completes only its claimed reminder', async () => {
  const fixture = deliveryFixture()
  await fixture.run()
  assert.equal(fixture.messages.length, 1)
  assert.equal(fixture.messages[0].clickUrl, 'https://example.com/leads-dashboard/12')
  assert.match(fixture.messages[0].message, /Client/)
  assert.ok(fixture.messages[0].message.includes('Scheduled: 01/01/2026, 05:00:00 PKT'))
  assert.equal(fixture.messages[0].title, 'Follow-up reminder')
  assert.match(fixture.calls[2].text, /follow_up_sent_at =/)
  assert.equal(fixture.calls[2].values[1], 'Sent')
  assert.ok(fixture.calls[2].values[0])
  assert.match(fixture.calls[2].text, /AND follow_up_claim =/)
  assert.equal(fixture.calls[2].values.at(-1), 'lease-123')
})

test('one repeat goes out 2 hours after the reminder, and only while it is unhandled', async () => {
  const fixture = deliveryFixture({ sentAt: '2026-01-01T00:00:10Z' })
  await fixture.run()
  const claimSql = fixture.calls[1].text
  assert.match(claimSql, /follow_up_repeat_sent_at IS NULL/)
  assert.ok(
    claimSql.includes("GREATEST(follow_up_at, follow_up_sent_at) + INTERVAL '2 hours' <= NOW()"),
  )
  assert.match(fixture.messages[0].title, /Second reminder/)
  assert.match(fixture.messages[0].message, /Still not marked contacted/)
  assert.match(fixture.calls[2].text, /follow_up_repeat_sent_at =/)
  assert.doesNotMatch(fixture.calls[2].text, /follow_up_sent_at =/)
  assert.equal(fixture.calls[2].values[1], 'Sent; repeat reminder sent')
})

test('delivery retries stop 24 hours after each reminder is due', async () => {
  const fixture = deliveryFixture()
  await fixture.run()
  assert.ok(fixture.calls[1].text.includes("follow_up_at > NOW() - INTERVAL '24 hours'"))
  assert.ok(fixture.calls[1].text.includes("INTERVAL '2 hours' + INTERVAL '24 hours' > NOW()"))
  assert.match(fixture.calls[0].text, /stopped retrying after 24 hours/)
  assert.match(fixture.calls[0].text, /follow_up_claim IS NULL/)
})

test('failed delivery retains an unsent reminder and a five-minute retry lease', async () => {
  const fixture = deliveryFixture({ result: { ok: false, status: '503' } })
  await fixture.run()
  assert.equal(fixture.calls[2].values[0], null)
  assert.match(fixture.calls[2].values[1], /503.*retrying in 5 minutes/)
  assert.match(fixture.calls[1].text, /5 minutes/)
})

test('cancelled or rescheduled claims are not delivered', async () => {
  const fixture = deliveryFixture({ cancelled: true })
  await fixture.run()
  assert.equal(fixture.messages.length, 0)
})
