import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isValidPhoneNumber } from 'libphonenumber-js'
import type { FeaturedProject, Media } from '@/payload-types'
import { formatPkr, smallestUnit } from '@/lib/featured-projects'
import { parseCookies, touchColumns } from '@/lib/lead-capture'
import {
  ATTRIBUTION_COOKIE,
  acquisitionSourceFromTouch,
  parseAttribution,
} from '@/lib/attribution'
import { isPaymentPlanCollection } from '@/lib/payment-plan-collections'
import { sendCapiEvent } from '@/lib/meta-capi'
import {
  computePlan,
  type ComputeInput,
  type InstallmentInput,
  type InstallmentFrequencyKind,
} from '@/lib/payment-plan'
import {
  DEFAULT_PAYMENT_HEADS,
  frequencyFromHeadName,
  type PaymentHead,
  type PaymentHeadCategory,
} from '@/lib/payment-heads'
import { PaymentPlanDocument, composeDisclaimer } from '@/components/projects/PaymentPlanPDF'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSideURL } from '@/utilities/getURL'

const ENGINE_VERSION = 'v2'

type ProjectHead = NonNullable<NonNullable<FeaturedProject['paymentPlan']>['paymentHeads']>[number]

function resolveHeads(project: FeaturedProject): PaymentHead[] {
  const raw = (project.paymentPlan?.paymentHeads ?? []) as ProjectHead[]
  if (!raw.length) return DEFAULT_PAYMENT_HEADS.map((h) => ({ ...h }))
  return raw.map((h) => ({
    name: h.name ?? '',
    category: (h.category as PaymentHeadCategory) ?? 'Initial Payment',
    enabled: h.enabled ?? true,
    isCustom: h.isCustom ?? false,
    numberOfSlabs: h.numberOfSlabs ?? null,
  }))
}

function parseInstallments(body: Record<string, unknown>): InstallmentInput[] {
  const raw = Array.isArray(body.installments) ? (body.installments as unknown[]) : []
  const kinds: InstallmentFrequencyKind[] = ['Monthly', 'Quarterly', 'HalfYearly']
  return kinds.map((kind) => {
    const r = raw.find((x): x is Record<string, unknown> => {
      return typeof x === 'object' && x !== null && (x as { kind?: string }).kind === kind
    })
    return {
      kind,
      active: Boolean(r?.active),
      locked: Boolean(r?.locked),
      valuePerPeriod: Number(r?.valuePerPeriod ?? 0) || 0,
    }
  })
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const projectSlug = typeof body.projectSlug === 'string' ? body.projectSlug.trim() : ''
  // Which collection to read the project from. Validated against an allowlist,
  // never trusted: this arrives in the request body and is used as a collection
  // name in a database read.
  const projectCollection = isPaymentPlanCollection(body.projectCollection)
    ? body.projectCollection
    : 'featured-projects'
  const downPaymentPct = Number(body.downPaymentPct)
  const possessionPctRaw = Number(body.possessionPct)
  const loanIncluded = Boolean(body.loanIncluded)
  const selectedUnitType =
    typeof body.selectedUnitType === 'string' ? body.selectedUnitType : null
  const selectedUnitName =
    typeof body.selectedUnitName === 'string' && body.selectedUnitName.trim()
      ? body.selectedUnitName.trim()
      : null
  const buyerEnabledHeadNames = Array.isArray(body.buyerEnabledHeadNames)
    ? (body.buyerEnabledHeadNames as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : null
  const installments = parseInstallments(body)

  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'Phone is required' }, { status: 400 })
  }
  if (!isValidPhoneNumber(phone, 'PK')) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid phone number' }, { status: 400 })
  }
  if (!projectSlug) {
    return NextResponse.json({ ok: false, error: 'projectSlug is required' }, { status: 400 })
  }
  if (!Number.isFinite(downPaymentPct)) {
    return NextResponse.json(
      { ok: false, error: 'downPaymentPct must be a number' },
      { status: 400 },
    )
  }

  const payload = await getPayload({ config })
  const projectRes = await payload.find({
    collection: projectCollection,
    where: { slug: { equals: projectSlug } },
    depth: 2,
    limit: 1,
  })
  const project = (projectRes.docs[0] as FeaturedProject | undefined) ?? null
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 })
  }
  const isMarketed = projectCollection === 'marketed-projects'
  const planConfig = project.paymentPlan
  if (planConfig?.enabled === false) {
    return NextResponse.json(
      { ok: false, error: 'Payment plan disabled for this project' },
      { status: 403 },
    )
  }

  // ── Unit resolution ─────────────────────────────────────────
  const unitTypes = project.unitTypes ?? []
  const selectedUnit = selectedUnitType
    ? (selectedUnitName
        ? unitTypes.find((u) => u.type === selectedUnitType && u.name === selectedUnitName)
        : null) ??
      unitTypes.find((u) => u.type === selectedUnitType) ??
      null
    : null

  const unitPrice =
    selectedUnit?.price ??
    planConfig?.priceOverride ??
    project.startingPrice ??
    smallestUnit(project)?.price ??
    0

  if (unitPrice <= 0) {
    return NextResponse.json(
      { ok: false, error: 'Project has no resolvable price' },
      { status: 400 },
    )
  }

  const unitLoanAmount = selectedUnit?.loanAmount ?? 0
  const totalDurationMonths = planConfig?.totalDurationMonths ?? 36

  // ── Head resolution: apply project enabled × buyer enabled ──
  const projectHeads = resolveHeads(project)
  const buyerSet = buyerEnabledHeadNames
    ? new Set(buyerEnabledHeadNames)
    : new Set(projectHeads.filter((h) => h.enabled).map((h) => h.name))
  const effectiveHeads: PaymentHead[] = projectHeads.map((h) => ({
    ...h,
    enabled: h.enabled && buyerSet.has(h.name),
  }))

  // Server-side enforcement of admin-visibility:
  //   • Possession slider can only carry value if Possession head is admin-enabled.
  //   • Only frequencies whose Time-Based head is admin-enabled count.
  const possessionAdminEnabled = projectHeads.some(
    (h) => h.enabled && h.category === 'Possession',
  )
  const possessionPct = !possessionAdminEnabled
    ? 0
    : Number.isFinite(possessionPctRaw)
      ? Math.min(5, Math.max(0, possessionPctRaw))
      : Math.min(5, planConfig?.possessionPct ?? 5)

  const adminAvailableFrequencies = new Set<string>()
  for (const h of projectHeads) {
    if (!h.enabled || h.category !== 'Time-Based') continue
    const k = frequencyFromHeadName(h.name)
    if (k) adminAvailableFrequencies.add(k)
  }
  const filteredInstallments = installments.filter((f) =>
    adminAvailableFrequencies.has(f.kind),
  )

  const unitDisplayLabel = selectedUnit
    ? selectedUnit.name
      ? `${selectedUnit.name} (${selectedUnit.type})`
      : selectedUnit.type
    : null

  // ── Compute ─────────────────────────────────────────────────
  const computeInput: ComputeInput = {
    unitPrice,
    loanIncluded,
    loanAmount: unitLoanAmount,
    totalDurationMonths,
    downPaymentPct,
    possessionPct,
    installments: filteredInstallments,
    heads: effectiveHeads,
  }
  const plan = computePlan(computeInput)

  if (plan.warnings.length > 0) {
    return NextResponse.json(
      { ok: false, error: plan.warnings.join(' · ') },
      { status: 400 },
    )
  }

  // ── Resolve assets ──────────────────────────────────────────
  const serverUrl = getServerSideURL().replace(/\/$/, '')
  const lateefLogoUrl = `${serverUrl}/brand/lateef-logo.png`
  const projectLogo = planConfig?.projectLogo as Media | number | null | undefined
  const projectLogoUrl =
    typeof projectLogo === 'object' && projectLogo?.url
      ? projectLogo.url.startsWith('http')
        ? projectLogo.url
        : `${serverUrl}${projectLogo.url}`
      : null
  const disclaimer = composeDisclaimer(planConfig?.planDisclaimer)
  const generatedAt = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // ── 5a. Audit-log row ───────────────────────────────────────
  // Awaited on purpose: a floating promise can be dropped when the container is
  // recycled before it settles, silently losing the lead record. A failure here
  // is logged but must never block the buyer's PDF.
  try {
    await payload.create({
      collection: 'payment-plan-leads',
      data: {
        name,
        phone,
        // Exactly one of these is set — writing a marketed id into the
        // featured-projects FK would violate the constraint and lose the row.
        project: isMarketed ? null : project.id,
        marketedProject: isMarketed ? project.id : null,
        projectTitleSnapshot: project.title,
        selectedUnitType: unitDisplayLabel ?? selectedUnit?.type ?? null,
        totalPrice: plan.totals.effectivePrice,
        downPaymentPct: plan.totals.downPayment / plan.totals.effectivePrice * 100,
        downPaymentAmount: plan.totals.downPayment,
        possessionPct,
        greyStructureSharePct: 50, // hard 50/50 in v2
        installmentFrequency:
          plan.cadence.activeFrequencies[0] === 'HalfYearly'
            ? 'Monthly'
            : (plan.cadence.activeFrequencies[0] as 'Monthly' | 'Quarterly' | undefined) ??
              'Monthly',
        totalDurationMonths,
        loanIncluded,
        loanAmount: loanIncluded ? unitLoanAmount : null,
        engineVersion: ENGINE_VERSION,
        planSummary: {
          ...plan,
          input: { ...computeInput, heads: effectiveHeads },
        },
        userAgent: req.headers.get('user-agent') ?? null,
      },
    })
  } catch (e) {
    console.warn('[payment-plan/pdf] PaymentPlanLeads persist failed:', (e as Error).message)
  }

  // ── 5a-ii. The CRM lead row ─────────────────────────────────
  // Downloading a custom payment plan is the highest-intent action on the site,
  // and until now it produced no `leads` row at all — the buyer existed in the
  // payment-plan audit log and in Privyr, but never appeared in the dashboard
  // the team actually works from. 11 of 13 such leads had no CRM record.
  //
  // Deliberately NOT routed through handleLeadCapture: that would forward to
  // Privyr a second time, and this route already does so below with the far
  // richer plan payload.
  //
  // `sourceKind` names the KIND OF PAGE rather than the form, so seedLeadDefaults
  // stamps the project relationships and brochure assets exactly as a form
  // submission would; `conversionSurface` is what records that this was the PDF.
  const cookies = parseCookies(req.headers.get('cookie'))
  // Attribution comes from our own cookie, never the request body.
  const attribution = parseAttribution(cookies[ATTRIBUTION_COOKIE])
  const firstTouch = attribution?.f ?? null
  const latestTouch = attribution?.l ?? firstTouch

  // Meta match signals, captured the same way lead-capture does. Used twice:
  // by the CAPI event below, and stored on the lead so the LATER Qualified /
  // Site Visit / Closed Won events have something to match a person against.
  const fbc = cookies['_fbc'] || null
  const fbp = cookies['_fbp'] || null
  const fbclid = fbc ? fbc.split('.').slice(3).join('.') || null : null
  const clientIp =
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    null
  // One id shared by the CAPI event and the browser pixel, so Meta counts the
  // download once rather than twice.
  const eventId = crypto.randomUUID()

  try {
    await payload.create({
      collection: 'leads',
      data: {
        name,
        phone,
        sourceKind: isMarketed ? 'marketed-project' : 'project',
        sourceName: project.title,
        sourceSlug: project.slug ?? undefined,
        placement: 'payment-plan-pdf',
        source: 'payment-plan:pdf',
        conversionSurface: 'payment-plan-pdf',
        interestedUnitType: unitDisplayLabel ?? selectedUnit?.type ?? undefined,
        // The plan they actually built — the single most useful thing for the
        // advisor making the call.
        notes: `Downloaded a payment plan: ${formatPkr(plan.totals.effectivePrice)} total, ${Math.round(
          (plan.totals.downPayment / plan.totals.effectivePrice) * 100,
        )}% down (${formatPkr(plan.totals.downPayment)}), ${totalDurationMonths} months.`,
        ...touchColumns('firstTouch', firstTouch),
        ...touchColumns('latestTouch', latestTouch),
        acquisitionSource: acquisitionSourceFromTouch(firstTouch),
        eventId,
        fbc: fbc ?? undefined,
        fbp: fbp ?? undefined,
        fbclid: fbclid ?? undefined,
        clientIp: clientIp ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
        // Privyr is forwarded separately below, with the full plan.
        privyrForwarded: false,
        privyrStatus: 'forwarded separately by payment-plan/pdf',
      },
      overrideAccess: true,
    })
  } catch (e) {
    // Never block the buyer's PDF on a CRM write.
    console.warn('[payment-plan/pdf] leads persist failed:', (e as Error).message)
  }

  // ── 5a-iii. Tell the ad account ─────────────────────────────
  // Building a payment plan is the strongest intent signal the site produces,
  // and until now the ad account never heard about it.
  //
  // A DISTINCT event, not 'Lead': someone who used the hero form and then
  // downloaded a plan would otherwise be counted as two leads, and Meta would
  // optimise toward a metric that double-counts. The name is overridable so it
  // can be pointed at a standard event without a deploy.
  //
  // No `value` is sent on purpose. The plan total is not revenue, and feeding it
  // to Meta as one would corrupt value-based optimisation and any ROAS figure.
  const capiEventName = process.env.META_CAPI_PAYMENT_PLAN_EVENT || 'PaymentPlanDownload'
  void sendCapiEvent({
    eventName: capiEventName,
    eventId,
    phone,
    fbc,
    fbp,
    fbclid,
    clientIp,
    userAgent: req.headers.get('user-agent'),
    customData: {
      content_name: project.title,
      ...(unitDisplayLabel ? { content_category: unitDisplayLabel } : {}),
    },
  }).catch((err) => {
    console.warn('[payment-plan/pdf] CAPI event failed:', (err as Error)?.message)
  })

  // ── 5b. Privyr forward ──────────────────────────────────────
  // Awaited so the request actually completes before the response is returned
  // (a floating fetch can be dropped on container recycle). `fetch` only rejects
  // on network errors, so we must also check `res.ok` — otherwise a 4xx from
  // Privyr is silently swallowed. Neither case may block the buyer's PDF.
  const privyrUrl = process.env.PRIVYR_WEBHOOK_URL
  if (privyrUrl) {
    try {
      const res = await fetch(privyrUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          sourceKind: 'payment-plan',
          sourceName: project.title,
          sourceSlug: project.slug,
          placement: 'payment-plan-pdf',
          projectName: project.title,
          projectSlug: project.slug,
          selectedUnitType: selectedUnit?.type ?? null,
          selectedUnitName: selectedUnit?.name ?? null,
          selectedUnitLabel: unitDisplayLabel,
          loanIncluded,
          loanAmount: loanIncluded ? unitLoanAmount : null,
          totalPrice: plan.totals.effectivePrice,
          downPaymentPct,
          possessionPct,
          downPaymentAmount: plan.totals.downPayment,
          installmentFrequencies: plan.cadence.activeFrequencies,
          activeMilestones: [
            ...plan.resolved.activeGreyHeadNames,
            ...plan.resolved.activeFinishingHeadNames,
          ],
          engineVersion: ENGINE_VERSION,
          timestamp: new Date().toISOString(),
        }),
      })
      if (!res.ok) {
        console.warn(
          `[payment-plan/pdf] Privyr rejected lead: ${res.status} ${res.statusText}`,
        )
      }
    } catch (e) {
      console.warn('[payment-plan/pdf] Privyr forward failed:', (e as Error).message)
    }
  }

  // ── 6. Render PDF ───────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      PaymentPlanDocument({
        projectTitle: project.title,
        projectLocation: project.location ?? 'Karachi',
        builderName: project.builderName ?? 'Lateef Properties',
        selectedUnitType: unitDisplayLabel ?? selectedUnit?.type ?? null,
        totalDurationMonths,
        buyer: { name, phone },
        plan,
        loanIncluded,
        loanAmount: unitLoanAmount,
        lateefLogoUrl,
        projectLogoUrl,
        disclaimer,
        generatedAt,
      }),
    )
  } catch (e) {
    console.error('[payment-plan/pdf] render failed:', (e as Error).message)
    return NextResponse.json(
      { ok: false, error: 'PDF render failed' },
      { status: 500 },
    )
  }

  const filename = `Lateef-${project.slug ?? 'project'}-PaymentPlan.pdf`
  return new Response(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      // The body is a PDF, so the browser pixel cannot read these from JSON.
      // It fires the same event name with the same id, and Meta collapses the
      // pair into one conversion.
      'X-Event-Id': eventId,
      'X-Event-Name': capiEventName,
    },
  })
}
