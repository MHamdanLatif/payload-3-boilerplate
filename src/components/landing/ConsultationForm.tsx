'use client'

import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Phone, Mail, MapPin, ArrowRight, RotateCcw } from 'lucide-react'
import { SectionRule } from './SectionRule'
import { fadeUp, staggerContainer, viewportOnce } from './_motion'
import { PROJECT_BUDGETS } from '@/lib/project-budgets'
import { trackLead, trackMetaLead } from '@/lib/analytics'
import { isValidPhoneNumber } from 'libphonenumber-js'

type FormValues = {
  fullName: string
  whatsapp: string
  location: string
  budget: string
  project: string
  notes: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const INITIAL: FormValues = {
  fullName: '',
  whatsapp: '',
  location: '',
  budget: '',
  project: '',
  notes: '',
}

function validate(values: FormValues): FormErrors {
  const errs: FormErrors = {}
  if (!values.fullName.trim() || values.fullName.trim().length < 2) {
    errs.fullName = 'Please share your full name.'
  }
  if (!values.whatsapp.trim()) {
    errs.whatsapp = 'A WhatsApp number is required.'
    // Defaults to Pakistan for bare local numbers, but any +country-code number
    // (US, UK, etc.) validates against its own country.
  } else if (!isValidPhoneNumber(values.whatsapp.trim(), 'PK')) {
    errs.whatsapp = 'Please enter a valid phone number.'
  }
  return errs
}

type ProjectOption = { id: number; title: string; slug: string }
export function ConsultationForm({
  projects,
  locations,
}: {
  projects: ProjectOption[]
  locations: string[]
}) {
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
      const project = projects.find((p) => String(p.id) === values.project)
      const composedNotes =
        [values.location ? `Preferred location: ${values.location}` : '', values.notes.trim()]
          .filter(Boolean)
          .join('\n') || null
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.fullName.trim(),
          phone: values.whatsapp.trim(),
          conversionSurface: 'consultation-form',
          sourceKind: project ? 'project' : 'consultation',
          sourceName: project?.title ?? null,
          sourceSlug: project?.slug ?? null,
          placement: 'home',
          source: 'home:consultation',
          budget: values.budget || null,
          notes: composedNotes,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setErrors({
          fullName: j.error ?? "Couldn't send right now. Please try again or WhatsApp us.",
        })
        setSubmitting(false)
        return
      }
      setSubmitting(false)
      setSubmitted(true)
      const result = (await res.json()) as { eventId?: string }
      trackLead({ form_name: 'contact', project: project?.slug })
      trackMetaLead(result.eventId, project?.title)
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
    <section id="contact" className="relative overflow-hidden bg-cream py-24 text-brand md:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--gold)/0.10),transparent_55%)]" />

      <div className="container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left — copy + contact */}
          <motion.div
            variants={staggerContainer}
            initial={false}
            whileInView="show"
            viewport={viewportOnce}
            className="min-w-0 lg:col-span-5"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                CONSULTATION
              </span>
              <span className="h-px w-10 bg-gold" />
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-[3.25rem]"
            >
              Let&rsquo;s find a property that{' '}
              <span className="italic text-gold">fits your plans.</span>
            </motion.h2>
            <motion.div variants={fadeUp}>
              <SectionRule className="mt-6" />
            </motion.div>

            <motion.p variants={fadeUp} className="mt-6 max-w-md text-brand/70 leading-relaxed">
              Tell us your budget and preferred location. We’ll help you explore suitable projects,
              understand the payment options and arrange a visit.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 space-y-1 text-sm">
              <a
                href="tel:+923363528333"
                className="group flex items-center gap-4 border-b border-brand/10 py-4 transition-colors hover:border-gold"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/15 bg-ivory text-gold transition-colors group-hover:border-gold">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-brand/55">
                    Call or WhatsApp
                  </p>
                  <p className="font-serif text-lg text-brand">+92-3363-LATEEF</p>
                </div>
              </a>
              <a
                href="mailto:info.lateefproperties@gmail.com"
                className="group flex items-center gap-4 border-b border-brand/10 py-4 transition-colors hover:border-gold"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/15 bg-ivory text-gold transition-colors group-hover:border-gold">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-brand/55">Email</p>
                  <p className="break-all font-serif text-base text-brand md:text-lg">
                    info.lateefproperties@gmail.com
                  </p>
                </div>
              </a>
              <a
                href="https://maps.app.goo.gl/RTVU2EMN8bzqwbQL9"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 border-b border-brand/10 py-4 transition-colors hover:border-gold"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/15 bg-ivory text-gold transition-colors group-hover:border-gold">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-brand/55">Office</p>
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
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative min-w-0 lg:col-span-7"
          >
            <div className="relative overflow-hidden rounded-3xl border border-brand/10 bg-white p-6 shadow-luxe sm:p-10">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

              <form
                onSubmit={onSubmit}
                className="grid grid-cols-1 gap-6 sm:grid-cols-2"
                noValidate
              >
                <Field label="Full Name" error={errors.fullName} className="sm:col-span-2">
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={values.fullName}
                    onChange={update('fullName')}
                    placeholder="e.g. Aisha Khan"
                    className={inputCls}
                  />
                </Field>

                <Field label="WhatsApp Number" error={errors.whatsapp}>
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    value={values.whatsapp}
                    onChange={update('whatsapp')}
                    placeholder="+92 3XXXXXXXXX"
                    className={inputCls}
                  />
                </Field>

                <Field label="Preferred Location (optional)">
                  <input
                    value={values.location}
                    onChange={update('location')}
                    className={inputCls}
                    list="consultation-locations"
                    placeholder="Your preferred area"
                  />
                  <datalist id="consultation-locations">
                    {locations.map((location) => (
                      <option key={location} value={location} />
                    ))}
                  </datalist>
                </Field>

                <Field label="Budget Range (optional)" error={errors.budget}>
                  <select value={values.budget} onChange={update('budget')} className={selectCls}>
                    <option value="">Select…</option>
                    {PROJECT_BUDGETS.map((b) => (
                      <option key={b.value} value={b.label}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Project of Interest (optional)" error={errors.project}>
                  <select value={values.project} onChange={update('project')} className={selectCls}>
                    <option value="">Not sure yet</option>
                    {projects.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Anything Else You’d Like Us to Know? (optional)"
                  className="sm:col-span-2"
                >
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
                    We’ll use your details to respond to your enquiry. Read our{' '}
                    <a href="/privacy" className="underline">
                      Privacy Policy
                    </a>
                    .
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-ivory shadow-luxe-sm transition-all duration-300 hover:bg-gold hover:text-brand hover:shadow-gold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : 'Discuss My Options'}
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
                      <p className="mt-6 eyebrow text-gold">
                        Thank you, {values.fullName.split(' ')[0]}.
                      </p>
                      <h3 className="mt-3 font-serif text-3xl leading-tight text-ivory">
                        Your enquiry has been received.
                      </h3>
                      <p className="mt-4 text-sm leading-relaxed text-ivory/80">
                        A Karachi-based advisor will message you on WhatsApp at the number you
                        shared. We&rsquo;ll cover what you&rsquo;re looking for, your budget and
                        suitable next steps.
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
      <span className="text-[0.7rem] uppercase tracking-[0.25em] text-brand/65">{label}</span>
      {children}
      {error && (
        <span className="text-xs font-medium text-destructive" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
