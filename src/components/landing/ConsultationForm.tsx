'use client'

import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Phone, Mail, MapPin, ArrowRight, RotateCcw } from 'lucide-react'
import { SectionRule } from './SectionRule'
import { fadeUp, staggerContainer, viewportOnce } from './_motion'

type FormValues = {
  fullName: string
  whatsapp: string
  propertyType: string
  budget: string
  project: string
  notes: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const INITIAL: FormValues = {
  fullName: '',
  whatsapp: '',
  propertyType: '',
  budget: '',
  project: '',
  notes: '',
}

const PROPERTY_TYPES = ['Apartment', 'Duplex', 'Commercial', 'Investment Allocation']
const BUDGETS = ['Under 1.5 Cr', '1.5 – 2.5 Cr', '2.5 – 5 Cr', '5 Cr+']
const PROJECTS = [
  'Pre-launch project',
  'Under-construction project',
  'Ready-for-possession',
  'Off-market / Resale',
  'No preference — show me everything',
]

const WHATSAPP_RE = /^(\+92|0)3\d{9}$/

function validate(values: FormValues): FormErrors {
  const errs: FormErrors = {}
  if (!values.fullName.trim() || values.fullName.trim().length < 2) {
    errs.fullName = 'Please share your full name.'
  }
  if (!values.whatsapp.trim()) {
    errs.whatsapp = 'A WhatsApp number is required.'
  } else if (!WHATSAPP_RE.test(values.whatsapp.replace(/\s|-/g, ''))) {
    errs.whatsapp = 'Use +92 3XXXXXXXXX or 03XXXXXXXXX.'
  }
  if (!values.propertyType) errs.propertyType = 'Choose a property type.'
  if (!values.budget) errs.budget = 'Choose a budget range.'
  if (!values.project) errs.project = 'Choose a project of interest.'
  return errs
}

export function ConsultationForm() {
  const [values, setValues] = useState<FormValues>(INITIAL)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update =
    <K extends keyof FormValues>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }))
      if (errors[key]) setErrors((errs) => ({ ...errs, [key]: undefined }))
    }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const v = validate(values)
    setErrors(v)
    if (Object.keys(v).length > 0) return
    setSubmitting(true)
    try {
      // Project field now stores a status preference (Pre-launch / Under-construction /
      // Ready-for-possession / Off-market / No preference), not a specific project name.
      // We prepend it to notes for Privyr context.
      const projectPref = values.project || null
      const buyerNotes = values.notes.trim()
      const composedNotes = projectPref
        ? `[Preference: ${projectPref}]${buyerNotes ? '\n' + buyerNotes : ''}`
        : buyerNotes || null
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.fullName.trim(),
          phone: values.whatsapp.trim(),
          sourceKind: 'consultation',
          sourceName: null,
          sourceSlug: null,
          placement: 'home',
          source: 'home:consultation',
          propertyType: values.propertyType || null,
          budget: values.budget || null,
          notes: composedNotes,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setErrors({ fullName: j.error ?? "Couldn't send right now. Please try again or WhatsApp us." })
        setSubmitting(false)
        return
      }
      setSubmitting(false)
      setSubmitted(true)
    } catch {
      setErrors({ fullName: 'Network error. Please try again.' })
      setSubmitting(false)
    }
  }

  const reset = () => {
    setValues(INITIAL)
    setErrors({})
    setSubmitted(false)
  }

  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-cream py-24 text-brand md:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--gold)/0.10),transparent_55%)]" />

      <div className="container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left — copy + contact */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="lg:col-span-5"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                06 / CONSULTATION
              </span>
              <span className="h-px w-10 bg-gold" />
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-[3.25rem]"
            >
              Tell us what you&rsquo;re looking for in{' '}
              <span className="italic text-gold">Karachi.</span>
            </motion.h2>
            <motion.div variants={fadeUp}>
              <SectionRule className="mt-6" />
            </motion.div>

            <motion.p variants={fadeUp} className="mt-6 max-w-md text-brand/70 leading-relaxed">
              Send your requirements — apartment, plot, office or shop — and a
              Karachi-based advisor will reach you on WhatsApp within 24 hours.
              No robocalls, no pressure.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 space-y-1 text-sm">
              <a
                href="tel:+923363528333"
                className="group flex items-center gap-4 border-b border-brand/10 py-4 transition-colors hover:border-gold"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand/15 bg-ivory text-gold transition-colors group-hover:border-gold">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-brand/55">
                    Direct line
                  </p>
                  <p className="font-serif text-lg text-brand">+92-3363-LATEEF</p>
                </div>
              </a>
              <a
                href="mailto:info.lateefproperties@gmail.com"
                className="group flex items-center gap-4 border-b border-brand/10 py-4 transition-colors hover:border-gold"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand/15 bg-ivory text-gold transition-colors group-hover:border-gold">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-brand/55">
                    Advisor desk
                  </p>
                  <p className="font-serif text-base text-brand md:text-lg">info.lateefproperties@gmail.com</p>
                </div>
              </a>
              <a
                href="https://maps.app.goo.gl/RTVU2EMN8bzqwbQL9"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 border-b border-brand/10 py-4 transition-colors hover:border-gold"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand/15 bg-ivory text-gold transition-colors group-hover:border-gold">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-brand/55">
                    Karachi office
                  </p>
                  <p className="font-serif text-base leading-snug text-brand md:text-lg">
                    Ground Floor, Four Seasons Apartment,
                    <br />
                    Block 16, Gulshan-e-Iqbal
                  </p>
                </div>
              </a>
            </motion.div>
          </motion.div>

          {/* Right — form card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative lg:col-span-7"
          >
            <div className="relative overflow-hidden rounded-3xl border border-brand/10 bg-white p-6 shadow-luxe sm:p-10">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2" noValidate>
                <Field
                  label="Full name"
                  error={errors.fullName}
                  className="sm:col-span-2"
                >
                  <input
                    type="text"
                    autoComplete="name"
                    value={values.fullName}
                    onChange={update('fullName')}
                    placeholder="e.g. Aisha Khan"
                    className={inputCls}
                  />
                </Field>

                <Field label="WhatsApp" error={errors.whatsapp}>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={values.whatsapp}
                    onChange={update('whatsapp')}
                    placeholder="+92 3XXXXXXXXX"
                    className={inputCls}
                  />
                </Field>

                <Field label="Property type" error={errors.propertyType}>
                  <select
                    value={values.propertyType}
                    onChange={update('propertyType')}
                    className={selectCls}
                  >
                    <option value="">Select…</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Budget range" error={errors.budget}>
                  <select
                    value={values.budget}
                    onChange={update('budget')}
                    className={selectCls}
                  >
                    <option value="">Select…</option>
                    {BUDGETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Project of interest" error={errors.project}>
                  <select
                    value={values.project}
                    onChange={update('project')}
                    className={selectCls}
                  >
                    <option value="">Select…</option>
                    {PROJECTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Notes (optional)" className="sm:col-span-2">
                  <textarea
                    rows={3}
                    value={values.notes}
                    onChange={update('notes')}
                    placeholder="Anything specific we should know — completion timing, financing, viewing windows…"
                    className={`${inputCls} resize-none`}
                  />
                </Field>

                <div className="sm:col-span-2 flex flex-col items-start gap-4 border-t border-brand/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-relaxed text-brand/60">
                    Your details stay private. We don&rsquo;t share enquirer
                    information with third parties.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-ivory shadow-luxe-sm transition-all duration-300 hover:bg-gold hover:text-brand hover:shadow-gold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : 'Book a Consultation'}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              </form>

              {/* Success overlay */}
              <AnimatePresence>
                {submitted && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-brand/97 backdrop-blur-sm"
                    style={{ backgroundColor: 'hsl(var(--brand-deep) / 0.97)' }}
                  >
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                      className="max-w-sm px-6 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0.6, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.6, delay: 0.2, type: 'spring', bounce: 0.4 }}
                        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold bg-gold/10 text-gold"
                      >
                        <Check className="h-7 w-7" strokeWidth={1.5} />
                      </motion.div>
                      <p className="mt-6 eyebrow text-gold">Thank you, {values.fullName.split(' ')[0]}.</p>
                      <h3 className="mt-3 font-serif text-3xl leading-tight text-ivory">
                        We&rsquo;ll be in touch within 24 hours.
                      </h3>
                      <p className="mt-4 text-sm leading-relaxed text-ivory/80">
                        A Karachi-based advisor will message you on WhatsApp at the
                        number you shared. We&rsquo;ll cover what you&rsquo;re looking for,
                        your budget, and the next viewing slot.
                      </p>
                      <button
                        type="button"
                        onClick={reset}
                        className="mt-8 inline-flex items-center gap-2 rounded-full border border-ivory/30 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-ivory transition-colors hover:border-gold hover:text-gold"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Send another enquiry
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const inputCls =
  'w-full rounded-lg border border-brand/15 bg-ivory px-4 py-3 text-sm text-brand placeholder:text-brand/35 transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

const selectCls = `${inputCls} appearance-none cursor-pointer pr-10 [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22 fill=%22none%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%23C5A059%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/></svg>')] [background-position:right_1rem_center] [background-repeat:no-repeat]`

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
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[0.7rem] uppercase tracking-[0.25em] text-brand/65">
        {label}
      </span>
      {children}
      {error && (
        <span className="text-xs font-medium text-destructive" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
