import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { computeAdminPlan, validateAdminPlan, type AdminPlanInput } from '@/lib/admin-payment-plan'
import { PaymentPlanDocument, composeDisclaimer } from '@/components/projects/PaymentPlanPDF'
import { getServerSideURL } from '@/utilities/getURL'
import type { Media } from '@/payload-types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || user.collection !== 'users')
    return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
  let body: { plan?: AdminPlanInput; buyer?: { name?: string; phone?: string } }
  try {
    const text = await req.text()
    if (text.length > 200_000)
      return NextResponse.json({ error: 'Plan is too large.' }, { status: 413 })
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const errors = validateAdminPlan(body?.plan)
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 })
  const input = body.plan!
  const project = await payload
    .findByID({
      collection: 'featured-projects',
      id: input.projectId,
      user,
      overrideAccess: false,
      depth: 1,
    })
    .catch(() => null)
  const unit = project?.unitTypes?.find((u) => u.id === input.unitId)
  if (!project || !unit)
    return NextResponse.json(
      { error: 'Project or unit no longer exists. Reload the studio.' },
      { status: 404 },
    )
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
        plan: result.plan,
        loanIncluded: false,
        loanAmount: 0,
        lateefLogoUrl: `${serverURL}/brand/lateef-logo.png`,
        projectLogoUrl,
        disclaimer: composeDisclaimer(project.paymentPlan?.planDisclaimer),
        generatedAt: new Date().toLocaleDateString('en-GB'),
        priceBreakdown: result.breakdown,
        scheduleLabel: 'Custom schedule',
      }),
    )
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Lateef-Custom-PaymentPlan.pdf"',
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
