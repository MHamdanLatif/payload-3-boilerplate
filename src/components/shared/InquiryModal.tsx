'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { LeadForm, type LeadFormSourceKind } from '@/components/forms/LeadForm'

type Props = {
  open: boolean
  onClose: () => void
  sourceName: string
  sourceSlug: string
  sourceKind: LeadFormSourceKind
}

export function InquiryModal({ open, onClose, sourceName, sourceSlug, sourceKind }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close inquiry"
            onClick={onClose}
            className="absolute inset-0 bg-brand-deep/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white text-brand-deep shadow-luxe"
          >
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <p className="eyebrow text-gold">Send Inquiry</p>
                <p className="mt-1 font-serif text-lg leading-tight text-brand-deep">
                  {sourceName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-deep/15 text-brand-deep transition-colors hover:border-gold hover:text-gold"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-6">
              <LeadForm
                sourceName={sourceName}
                sourceSlug={sourceSlug}
                sourceKind={sourceKind}
                placement="modal"
                tone="light"
                submitLabel="Send Inquiry"
                onSuccess={onClose}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
