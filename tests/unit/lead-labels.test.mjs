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

const labels = load('src/lib/lead-labels.ts', {})
const { whatsappSendUrl, buildBrochureMessage } = load('src/lib/brochure-message.ts', {})
const { leadNotificationMessage } = load('src/lib/lead-notification-message.ts', {
  './lead-labels': labels,
  '@/utilities/getURL': { getServerSideURL: () => 'https://example.com' },
  './lead-action-link': { signLeadAction: () => 'signature' },
})
test('acquisition and conversion remain independent, including legacy and unknown leads', () => {
  assert.match(
    labels.leadSourceLabel({ acquisitionSource: 'meta-ads', source: 'payment-plan:pdf' }),
    /Paid.*Meta ads.*Payment plan PDF download/,
  )
  assert.match(
    labels.leadSourceLabel({
      acquisitionSource: 'google-organic',
      source: 'project-landing:brochure',
    }),
    /Organic.*Google search.*brochure request form/,
  )
  assert.match(
    labels.leadSourceLabel({
      acquisitionSource: 'meta-ads',
      source: 'marketed-project-landing:hero',
    }),
    /Paid.*Meta ads.*Marketing page: top/,
  )
  assert.match(
    labels.leadSourceLabel({ source: 'marketed-project-landing:hero' }),
    /^Source not recorded/,
  )
  assert.match(
    labels.leadSourceLabel({ acquisitionSource: 'direct', source: 'project-landing:final' }),
    /^Direct website visit.*bottom/,
  )
  assert.equal(
    labels.leadFormLabel({ source: 'listing-landing:modal', conversionSurface: 'listing-form' }),
    'Property listing: popup enquiry form',
  )
  assert.equal(labels.leadChannelLabel({}), 'Source not recorded')
})
test('new lead and reminder notifications show the project, acquisition, and form', () => {
  for (const kind of ['new', '30m', '2h']) {
    const result = leadNotificationMessage(
      {
        id: 1,
        name: 'Buyer',
        phone: '+923001234567',
        brochureId: 'abc',
        sourceName: 'Tulip Comforts',
        acquisitionSource: 'google-organic',
        source: 'payment-plan:pdf',
      },
      kind,
    )
    assert.match(result.message, /Tulip Comforts/)
    assert.match(result.message, /Organic.*Google search/)
    assert.match(result.message, /Payment plan PDF download/)
    assert.equal(result.actions[0].action, 'send-brochure')
  }
})
test('Android Business intent preserves the complete message and an encoded web fallback', () => {
  const message =
    buildBrochureMessage({
      name: 'Buyer',
      project: 'Tulip & Comforts',
      link: 'https://example.com/brochure/abc?a=1&b=2',
    }) + '\n#Intent; test'
  const web = whatsappSendUrl('+92 300 1234567', message)
  const intent = whatsappSendUrl('+92 300 1234567', message, 'Mozilla/5.0 (Linux; Android 14)')
  assert.match(intent, /^intent:\/\/send\?phone=923001234567&text=/)
  assert.ok(intent.includes(';package=com.whatsapp.w4b;'))
  assert.equal(decodeURIComponent(intent.split('&text=')[1].split('#Intent;')[0]), message)
  assert.equal(decodeURIComponent(intent.split('S.browser_fallback_url=')[1].split(';end')[0]), web)
  assert.equal(whatsappSendUrl('+92 300 1234567', message, 'iPhone'), web)
})
