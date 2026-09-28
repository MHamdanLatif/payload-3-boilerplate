import Link from 'next/link'
import { crmProjects, crmSession } from '@/lib/crm-server'
import { ManualLeadForm } from '@/components/crm/LeadForm'
export default async function NewLead() {
  await crmSession('/leads-dashboard/new')
  const projects = await crmProjects()
  return (
    <main className="crm-wrap" style={{ maxWidth: 620 }}>
      <Link href="/leads-dashboard" className="crm-muted">
        Back to leads
      </Link>
      <p className="crm-eyebrow mt-7">A new conversation</p>
      <h1 className="crm-title">Add a lead</h1>
      <p className="crm-muted mb-6 mt-2">Four details. Ready to follow up.</p>
      <ManualLeadForm projects={projects} />
    </main>
  )
}
