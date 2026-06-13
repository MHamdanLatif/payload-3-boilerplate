'use client'

import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import type { ParsedSearchParams } from '@/lib/property-search'

const WHATSAPP_RE = /^(\+92|0)3\d{9}$/

export function ZeroResultsLeadTrap({ searchedParams }: { searchedParams: ParsedSearchParams }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; api?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const summarize = (sp: ParsedSearchParams): string => {
    const bits: string[] = []
    if (sp.location) bits.push(sp.location)
    if (sp.propertyType) bits.push(sp.propertyType)
    if (sp.status) bits.push(sp.status)
    if (sp.minPrice || sp.maxPrice) {
      const min = sp.minPrice ? `PKR ${sp.minPrice.toLocaleString()}` : 'any'
      const max = sp.maxPrice ? `PKR ${sp.maxPrice.toLocaleString()}` : 'any'
      bits.push(`budget ${min} – ${max}`)
    }
    return bits.length ? bits.join(' · ') : 'no filters applied'
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!name.trim() || name.trim().length < 2) errs.name = 'Please share your name.'
    if (!phone.trim()) errs.phone = 'A phone number is required.'
    else if (!WHATSAPP_RE.test(phone.replace(/\s|-/g, '')))
      errs.phone = 'Use +92 3XXXXXXXXX or 03XXXXXXXXX.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim() || null,
          sourceKind: 'zero-results',
          source: 'properties:zero-results',
          placement: 'zero-results',
          searchedParams,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setErrors({ api: j.error ?? 'Could not send right now. Please try again or WhatsApp us.' })
        setSubmitting(false)
        return
      }
      setSubmitted(true)
    } catch {
      setErrors({ api: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setName('')
    setPhone('')
    setNotes('')
    setErrors({})
    setSubmitted(false)
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white shadow-luxe">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--gold)/0.18),transparent_55%)]" />

      <div className="grid grid-cols-1 gap-10 p-8 sm:p-12 lg:grid-cols-12 lg:gap-16 lg:p-16">
        <div className="lg:col-span-5">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
            OFF-MARKET INVENTORY
          </span>
          <h2 className="mt-5 font-serif text-3xl leading-[1.1] tracking-tight md:text-4xl lg:text-[2.75rem]">
            Couldn&rsquo;t find an exact match? Our{' '}
            <span className="italic text-gold">off-market list</span> updates daily.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75 md:text-base">
            Drop your requirements and a senior advisor will source it within 48 hours.
            No spam. No follow-up calls outside working hours.
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="eyebrow text-gold">You searched for</p>
            <p className="mt-2 text-sm leading-relaxed text-white/85">{summarize(searchedParams)}</p>
            <p className="mt-3 text-xs text-white/55">
              We&rsquo;ll match against off-market inventory and call you back with a verified shortlist.
            </p>
          </div>
        </div>

        <div className="relative lg:col-span-7">
          <form
            onSubmit={onSubmit}
            noValidate
            className="grid grid-cols-1 gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:grid-cols-2 sm:p-8"
          >
            <Field label="Full name" error={errors.name} className="sm:col-span-2">
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aisha Khan"
                className={inputCls}
              />
            </Field>

            <Field label="Phone / WhatsApp" error={errors.phone} className="sm:col-span-2">
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 3XXXXXXXXX"
                className={inputCls}
              />
            </Field>

            <Field label="Notes (optional)" className="sm:col-span-2">
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything specific — completion timing, financing, preferred floor…"
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="sm:col-span-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-white/55">
                Your details remain private. Used only to source matching inventory.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Source my match'}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>

            {errors.api && (
              <p className="sm:col-span-2 text-xs text-gold-soft" role="alert">
                {errors.api}
              </p>
            )}
          </form>

          <AnimatePresence>
            {submitted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'hsl(var(--brand-deep) / 0.97)' }}
              >
                <motion.div
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-sm px-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.6, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.2, type: 'spring', bounce: 0.4 }}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold bg-gold/10 text-gold"
                  >
                    <Check className="h-6 w-6" strokeWidth={1.5} />
                  </motion.div>
                  <p className="mt-5 eyebrow text-gold">Got it, {name.split(' ')[0] || 'there'}.</p>
                  <h3 className="mt-3 font-serif text-2xl leading-tight">
                    A shortlist within 48 hours.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/75">
                    A senior advisor will reach you on WhatsApp with verified, off-market matches.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white transition-colors hover:border-gold hover:text-gold"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Send another
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

function Field({
  label,
  error,
  className = '',
  children,
}: {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] uppercase tracking-[0.25em] text-white/55">{label}</span>
      {children}
      {error && (
        <span className="text-xs text-gold-soft" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-white/15 bg-brand-deep/40 px-3 py-3 text-sm text-white placeholder:text-white/40 transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'
