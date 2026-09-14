import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { PaymentPlanStudio } from '@/components/admin/PaymentPlanStudio'

export const dynamic = 'force-dynamic'

export default async function PaymentPlansPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'users') redirect('/admin/login')
  const result = await payload.find({
    collection: 'featured-projects',
    user,
    overrideAccess: false,
    pagination: false,
    depth: 0,
    sort: 'title',
    select: { title: true, slug: true, unitTypes: true, paymentPlan: true },
  })
  return <PaymentPlanStudio projects={result.docs} />
}
