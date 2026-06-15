'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { BrochureDownloadModal } from './BrochureDownloadModal'

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
        <Download className="h-4 w-4" />
        Download Brochure
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
