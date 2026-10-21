import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import {
  computeAdminPlan,
  summarizeAdminPlan,
  validateAdminPlan,
  withUnitLoan,
  type AdminPlanInput,
} from '@/lib/admin-payment-plan'
import { loadUnitLayout, finishSchedulePDF } from '@/lib/payment-plan-layout'
import { PaymentPlanDocument, composeDisclaimer } from '@/components/projects/PaymentPlanPDF'
import { getServerSideURL } from '@/utilities/getURL'
import type { Media } from '@/payload-types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || user.collection !== 'users')
    return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
  let body: {
    plan?: AdminPlanInput
    buyer?: { name?: string; phone?: string }
    format?: 'full' | 'summary'
    savedRevision?: { scheduleId?: number; revision?: number }
  }
  try {
    const text = await req.text()
    if (text.length > 200_000)
      return NextResponse.json({ error: 'Plan is too large.' }, { status: 413 })
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  // An unedited saved revision exports from its stored settings, exactly as it was sent
  // (including its stored loan amount). Only unsaved Studio plans take the CMS loan below.
  const saved = body?.savedRevision
  if (saved !== undefined) {
    if (
      !saved ||
      typeof saved !== 'object' ||
      !Number.isSafeInteger(saved.scheduleId) ||
      !Number.isSafeInteger(saved.revision)
    )
      return NextResponse.json({ error: 'Invalid saved revision.' }, { status: 400 })
    const stored = (
      await payload
        .find({
          collection: 'schedule-revisions',
          where: {
            and: [
              { schedule: { equals: saved.scheduleId } },
              { revision: { equals: saved.revision } },
            ],
          },
          limit: 1,
          depth: 0,
          user,
          overrideAccess: false,
        })
        .catch(() => null)
    )?.docs[0]
    if (!stored)
      return NextResponse.json(
        { error: 'This saved revision no longer exists. Reload the schedule.' },
        { status: 404 },
      )
    body.plan = stored.settings as unknown as AdminPlanInput
  }
  const errors = validateAdminPlan(body?.plan)
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 })
  if (body.format !== undefined && !['full', 'summary'].includes(body.format))
    return NextResponse.json({ error: 'Choose a full or summarized PDF.' }, { status: 400 })
  const project = await payload
    .findByID({
      collection: 'featured-projects',
      id: body.plan!.projectId,
      user,
      overrideAccess: false,
      depth: 1,
    })
    .catch(() => null)
  const unit = project?.unitTypes?.find((u) => u.id === body.plan!.unitId)
  if (!project || !unit)
    return NextResponse.json(
      { error: 'Project or unit no longer exists. Reload the studio.' },
      { status: 404 },
    )
  const input = saved ? body.plan! : withUnitLoan(body.plan!, unit.loanAmount)
  const loanErrors = validateAdminPlan(input)
  if (loanErrors.length) return NextResponse.json({ error: loanErrors.join(' ') }, { status: 400 })
  const result = computeAdminPlan(input)
  if (result.plan.warnings.length)
    return NextResponse.json({ error: result.plan.warnings.join(' ') }, { status: 400 })
  if (
    body.buyer &&
    (typeof body.buyer !== 'object' ||
      (body.buyer.name !== undefined && typeof body.buyer.name !== 'string') ||
      (body.buyer.phone !== undefined && typeof body.buyer.phone !== 'string'))
  )
    return NextResponse.json({ error: 'Invalid buyer details.' }, { status: 400 })
  const serverURL = getServerSideURL().replace(/\/$/, '')
  const logo = project.paymentPlan?.projectLogo as Media | null | undefined
  const projectLogoUrl =
    logo && typeof logo === 'object' && logo.url ? new URL(logo.url, serverURL).toString() : null
  try {
    const layout = await loadUnitLayout(unit.flatLayout, serverURL)
    const buffer = await renderToBuffer(
      PaymentPlanDocument({
        projectTitle: project.title,
        projectLocation: project.location ?? 'Karachi',
        builderName: project.builderName,
        selectedUnitType: unit.name ? `${unit.name} (${unit.type})` : unit.type,
        totalDurationMonths: input.duration,
        buyer: {
          name: body.buyer?.name?.trim().slice(0, 120) ?? '',
          phone: body.buyer?.phone?.trim().slice(0, 60) ?? '',
        },
        plan: body.format === 'summary' ? summarizeAdminPlan(result.plan) : result.plan,
        summary: body.format === 'summary',
        installmentStartMonth: input.installmentStartMonth,
        layoutImage: layout?.image,
        pageNumbers: false,
        loanIncluded: result.loanAmount > 0,
        loanAmount: result.loanAmount,
        loanOnDemand: true,
        lateefLogoUrl: `${serverURL}/brand/lateef-logo.png`,
        projectLogoUrl,
        disclaimer: composeDisclaimer(project.paymentPlan?.planDisclaimer),
        generatedAt: new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' }),
        priceBreakdown: result.breakdown,
        scheduleLabel: 'Custom schedule',
      }),
    )
    return new Response(await finishSchedulePDF(buffer, layout?.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Lateef-${body.format === 'summary' ? 'Summary' : 'Complete'}-PaymentPlan.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.error(
      '[admin/payment-plan/pdf] render failed',
      e instanceof Error ? e.message : 'Unknown error',
    )
    return NextResponse.json(
      { error: 'PDF could not be rendered. Please try again.' },
      { status: 500 },
    )
  }
}
