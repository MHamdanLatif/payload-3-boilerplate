'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { isPossiblePhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import '@/styles/phone-input.css'
import { Check, Download, Loader2, X } from 'lucide-react'
import { cn } from '@/utilities/cn'

const PhoneInput = dynamic(() => import('react-phone-number-input'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[42px] items-center rounded-md border border-brand-deep/15 bg-white px-3 text-sm text-brand-deep/55">
      Loading…
    </div>
  ),
})

type Props = {
  open: boolean
  onClose: () => void
  projectTitle: string
  projectSlug: string
  brochureUrl: string
}

export function BrochureDownloadModal({
  open,
  onClose,
  projectTitle,
  projectSlug,
  brochureUrl,
}: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState<string | undefined>(undefined)
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

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

  useEffect(() => {
    if (open) {
      setDone(false)
      setServerError(null)
      setErrors({})
    }
  }, [open])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!name.trim() || name.trim().length < 2) next.name = 'Please enter your name'
    if (!phone || !isPossiblePhoneNumber(phone))
      next.phone = 'Please enter a valid phone number'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setServerError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          sourceKind: 'project',
          source: 'project-landing:brochure',
          placement: 'modal',
          sourceName: projectTitle,
          sourceSlug: projectSlug,
          notes: 'Downloaded project brochure',
        }),
      })
      if (!res.ok) {
        let msg = 'Could not record your request.'
        try {
          const j = (await res.json()) as { error?: string }
          if (j?.error) msg = j.error
        } catch {}
        setServerError(msg)
        return
      }

      // Trigger the brochure download.
      const a = document.createElement('a')
      a.href = brochureUrl
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.download = `Lateef-${projectSlug}-Brochure.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setDone(true)
    } catch (e) {
      setServerError((e as Error).message || 'Network error.')
    } finally {
      setSubmitting(false)
    }
  }

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
          aria-labelledby="brochure-modal-title"
        >
          <button
            type="button"
            aria-label="Close"
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
            <div className="flex items-start justify-between border-b border-brand-deep/10 px-6 py-5">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gold">
                  Download Brochure
                </p>
                <p
                  id="brochure-modal-title"
                  className="mt-1 font-serif text-lg leading-tight text-brand-deep"
                >
                  {projectTitle}
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
              {done ? (
                <div className="py-2 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
                    <Check className="h-6 w-6" />
                  </div>
                  <p className="mt-4 font-serif text-xl text-brand-deep">Brochure on its way.</p>
                  <p className="mt-2 text-sm text-brand-deep/65">
                    If the download didn&rsquo;t start automatically,{' '}
                    <a
                      href={brochureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold underline-offset-2 hover:underline"
                    >
                      open it here
                    </a>
                    . A senior advisor will follow up within 24 hours.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 rounded-full border border-brand-deep/15 px-5 py-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep transition-colors hover:border-gold hover:text-gold"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-4">
                  <p className="rounded-md border border-brand-deep/10 bg-cream/40 px-4 py-3 text-xs leading-relaxed text-brand-deep/75">
                    Share your name and phone — we&rsquo;ll start the brochure download and have an
                    advisor reach out with current availability and unit-level pricing.
                  </p>

                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55">
                      Full Name
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={cn(
                        'rounded-md border border-brand-deep/15 bg-white px-3 py-2.5 text-sm text-brand-deep placeholder:text-brand-deep/35 focus:border-gold focus:outline-none',
                        errors.name && 'border-red-400',
                      )}
                    />
                    {errors.name && (
                      <span className="text-xs text-red-500">{errors.name}</span>
                    )}
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55">
                      Phone
                    </span>
                    <PhoneInput
                      defaultCountry="PK"
                      international
                      value={phone}
                      onChange={setPhone}
                      placeholder="3XX XXXXXXX"
                      className="PhoneInput"
                      countryCallingCodeEditable={false}
                    />
                    {errors.phone && (
                      <span className="text-xs text-red-500">{errors.phone}</span>
                    )}
                  </label>

                  {serverError && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {serverError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep shadow-gold transition-colors hover:bg-gold-hover disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Preparing…
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download Brochure
                      </>
                    )}
                  </button>

                  <p className="text-center text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/50">
                    Your details stay private — used only to follow up.
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
