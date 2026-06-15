import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { FeaturedProject, Media } from '@/payload-types'
import { smallestUnit } from '@/lib/featured-projects'
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
    collection: 'featured-projects',
    where: { slug: { equals: projectSlug } },
    depth: 2,
    limit: 1,
  })
  const project = (projectRes.docs[0] as FeaturedProject | undefined) ?? null
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 })
  }
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
  payload
    .create({
      collection: 'payment-plan-leads',
      data: {
        name,
        phone,
        project: project.id,
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
    .catch((e) => {
      console.warn('[payment-plan/pdf] PaymentPlanLeads persist failed:', (e as Error).message)
    })

  // ── 5b. Privyr forward ──────────────────────────────────────
  const privyrUrl = process.env.PRIVYR_WEBHOOK_URL
  if (privyrUrl) {
    fetch(privyrUrl, {
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
    }).catch((e) => {
      console.warn('[payment-plan/pdf] Privyr forward failed:', (e as Error).message)
    })
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
    },
  })
}
