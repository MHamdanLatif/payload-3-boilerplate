'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { BrochureDownloadModal } from './BrochureDownloadModal'

/**
 * The brochure is no longer downloadable from the site. This captures the
 * enquiry and hands off to WhatsApp, where an advisor sends the brochure along
 * with the personalised project pack — so a brochure request becomes a real
 * conversation instead of an anonymous file download.
 *
 * `brochureUrl` is kept because it still records WHICH document the lead asked
 * for on the CRM row; it simply no longer triggers a client-side download.
 */
type Props = {
  brochureUrl: string
  projectTitle: string
  projectSlug: string
}

export function BrochureDownloadButton({ brochureUrl, projectTitle, projectSlug }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold hover:text-brand-deep"
      >
        <MessageCircle className="h-4 w-4" />
        Get Project Details on WhatsApp
      </button>
      <BrochureDownloadModal
        open={open}
        onClose={() => setOpen(false)}
        brochureUrl={brochureUrl}
        projectTitle={projectTitle}
        projectSlug={projectSlug}
      />
    </>
  )
}
