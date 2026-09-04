'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
// Validation helper is tiny — keep static so submit can validate without
// waiting for the dynamic component chunk to load.
import { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import '@/styles/phone-input.css'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { cn } from '@/utilities/cn'
import { trackLead, trackMetaLead } from '@/lib/analytics'
import type { ConversionSurface } from '@/lib/attribution'
import { PHONE_E164, whatsappUrl } from '@/lib/contact'

// GA4 form_name per source kind. Keeps the conversion event segmentable by the
// kind of page the enquiry came from.
const LEAD_FORM_NAME: Record<LeadFormSourceKind, string> = {
  project: 'project_enquiry',
  // Deliberately the same GA4 form_name as an organic project enquiry, so the
  // existing conversion history stays one continuous series. Paid vs organic is
  // already answerable from `acquisitionSource` and `conversionSurface`.
  'marketed-project': 'project_enquiry',
  listing: 'listing_enquiry',
  location: 'location_enquiry',
  'payment-plan': 'payment_plan_enquiry',
}

// The PhoneInput component pulls in the country flag SVG metadata
// (~50 KB gzipped on its own). Defer to a separate chunk so pages that
// don't mount a form (e.g. /blog, /properties, /locations) skip the cost.
const PhoneInput = dynamic(() => import('react-phone-number-input'), {
  ssr: false,
  loading: () => (
    <div
      aria-busy="true"
      className="flex h-[42px] items-center rounded-md border border-input bg-background/40 px-3 text-sm text-muted-foreground"
    >
      Loading…
    </div>
  ),
})

export type LeadFormPlacement = 'hero' | 'final' | 'modal'
export type LeadFormSourceKind =
  | 'project'
  | 'marketed-project'
  | 'listing'
  | 'location'
  | 'payment-plan'

/** The "Interested in" escape hatch. A real answer, not a missing one. */
export const NOT_SURE_YET = 'Not sure yet'

type Props = {
  sourceName: string
  sourceSlug: string
  sourceKind: LeadFormSourceKind
  placement?: LeadFormPlacement
  tone?: 'light' | 'dark'
  submitLabel?: string
  footnote?: string
  onSuccess?: () => void
  /**
   * Overrides the placement-derived default. Needed because the same form serves
   * the organic project pages and the paid landing pages, and an unrecognised
   * surface is silently dropped server-side.
   */
  conversionSurface?: ConversionSurface
  /**
   * When present, renders a required "Interested in" select built from the
   * project's own units, with `NOT_SURE_YET` appended.
   */
  unitOptions?: string[]
  /**
   * Confirm in place instead of navigating to /thank-you. Used where a
   * navigation would hand a converted visitor the full site, nav included.
   */
  inlineSuccess?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LeadForm({
  sourceName,
  sourceSlug,
  sourceKind,
  placement = 'hero',
  tone = 'light',
  submitLabel = 'Request a Callback',
  footnote = "We typically call within 15 minutes. Your details stay private.",
  onSuccess,
  conversionSurface,
  unitOptions,
  inlineSuccess = false,
}: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState<string | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [unit, setUnit] = useState('')
  const [errors, setErrors] = useState<{
    name?: string
    phone?: string
    email?: string
    unit?: string
    api?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const isDark = tone === 'dark'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!name.trim() || name.trim().length < 2) errs.name = 'Please share your full name.'
    if (!phone) errs.phone = 'Phone number is required.'
    else if (!isValidPhoneNumber(phone)) errs.phone = 'Please enter a valid phone number.'
    if (email && !EMAIL_RE.test(email)) errs.email = 'Email looks invalid.'
    if (unitOptions?.length && !unit) errs.unit = 'Please pick one — "Not sure yet" is fine.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim() || null,
          sourceName,
          sourceSlug,
          sourceKind,
          placement,
          source: `${sourceKind}-landing:${placement}`,
          interestedUnitType: unit || null,
          // WHERE the conversion happened, as opposed to how the buyer was
          // acquired. Derived from placement because this same form serves the
          // hero, the closing CTA and the modal — unless the caller names it.
          conversionSurface:
            conversionSurface ??
            (placement === 'hero' ? 'project-hero-form' : 'project-enquiry-cta'),
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setErrors({ api: j.error ?? "Couldn't send right now. Please try again or WhatsApp us." })
        setSubmitting(false)
        return
      }
      // Confirmed success (Privyr accepted the lead). Fire the GA4 conversion
      // before navigating away so it's queued while this page is still live.
      trackLead({ form_name: LEAD_FORM_NAME[sourceKind], project: sourceSlug || undefined })
      onSuccess?.()
      // Carry the server's event id so the pixel on /thank-you can fire Lead
      // with the SAME event_id and Meta deduplicates the pair. A random UUID,
      // not personal data.
      const ok = (await res.json().catch(() => ({}))) as { eventId?: string }
      const eventId = ok.eventId

      // Confirming in place means /thank-you never loads — and /thank-you is
      // where the browser pixel normally fires Lead carrying the server's
      // event_id. Fire it here instead, or Meta sees only the CAPI half of the
      // pair, which costs match quality and therefore optimisation.
      if (inlineSuccess) {
        trackMetaLead(eventId, sourceName || undefined)
        setDone(true)
        setSubmitting(false)
        return
      }

      router.push(
        `/thank-you?source=${sourceKind}:${encodeURIComponent(sourceSlug)}` +
          (eventId ? `&eid=${encodeURIComponent(eventId)}` : ''),
      )
    } catch {
      setErrors({ api: 'Network error. Please try again.' })
      setSubmitting(false)
    }
  }

  const labelCls = cn(
    'text-[0.7rem] uppercase tracking-[0.25em]',
    isDark ? 'text-white/65' : 'text-brand-deep/65',
  )
  const inputCls = cn(
    'h-11 w-full rounded-lg px-3 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/30',
    isDark
      ? 'border border-white/15 bg-white/[0.04] text-white placeholder:text-white/40 focus:border-gold'
      : 'border border-brand-deep/15 bg-ivory text-brand-deep placeholder:text-brand-deep/35 focus:border-gold',
  )
  const errorCls = 'text-xs font-medium text-gold-soft'
  // Native dropdown items always render on the browser's own light background,
  // regardless of the form's tone, so they are pinned rather than inherited.
  const optionCls = 'bg-white text-brand-deep'

  if (done) {
    // The WhatsApp button is the point of this state, not decoration: the
    // promise made above the form is that details arrive on WhatsApp, so the
    // confirmation hands them the thread rather than a dead end.
    return (
      <div
        className={cn(
          'flex flex-col gap-4 rounded-xl border p-6 text-center',
          isDark ? 'border-white/15 bg-white/[0.04]' : 'border-gold/40 bg-gold/5',
        )}
        role="status"
        aria-live="polite"
      >
        <span
          className={cn(
            'mx-auto flex h-11 w-11 items-center justify-center rounded-full',
            isDark ? 'bg-gold/20 text-gold' : 'bg-gold text-brand-deep',
          )}
        >
          <Check className="h-5 w-5" />
        </span>
        <p
          className={cn(
            'font-serif text-xl',
            isDark ? 'text-white' : 'text-brand-deep',
          )}
        >
          You&rsquo;re registered.
        </p>
        <p className={cn('text-sm leading-relaxed', isDark ? 'text-white/70' : 'text-brand-deep/70')}>
          We&rsquo;ll send the details and pricing to your WhatsApp within a couple of minutes.
        </p>
        <a
          href={whatsappUrl(
            sourceName
              ? `Hi, I just registered my interest in ${sourceName}.`
              : 'Hi, I just registered my interest through your website.',
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-gold hover:text-brand-deep"
        >
          Message us on WhatsApp
        </a>
        <a
          href={`tel:${PHONE_E164}`}
          className={cn('text-xs underline underline-offset-4', isDark ? 'text-white/55' : 'text-brand-deep/55')}
        >
          Or call now
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Full name</span>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aisha Khan"
          className={inputCls}
        />
        {errors.name && <span className={errorCls}>{errors.name}</span>}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Phone</span>
        <PhoneInput
          defaultCountry="PK"
          international
          value={phone}
          onChange={setPhone}
          placeholder="3XX XXXXXXX"
          className={isDark ? 'PhoneInput PhoneInput--on-dark' : 'PhoneInput'}
          countryCallingCodeEditable={false}
        />
        {errors.phone && <span className={errorCls}>{errors.phone}</span>}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>
          Email <span className="opacity-60">(optional)</span>
        </span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputCls}
        />
        {errors.email && <span className={errorCls}>{errors.email}</span>}
      </label>

      {unitOptions && unitOptions.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Interested in which unit type</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={cn(inputCls, 'appearance-none pr-8')}
          >
            {/* Every option carries its own colours. The dark-tone form paints
                the select white-on-navy, and browsers apply that same text
                colour to the native dropdown list — which renders on its own
                white background, leaving the options invisible until hovered. */}
            <option className={optionCls} value="">
              Select an option
            </option>
            {unitOptions.map((o) => (
              <option className={optionCls} key={o} value={o}>
                {o}
              </option>
            ))}
            <option className={optionCls} value={NOT_SURE_YET}>
              {NOT_SURE_YET}
            </option>
          </select>
          {errors.unit && <span className={errorCls}>{errors.unit}</span>}
        </label>
      )}

      <input type="hidden" name="sourceName" value={sourceName} />
      <input type="hidden" name="sourceSlug" value={sourceSlug} />
      <input type="hidden" name="sourceKind" value={sourceKind} />
      <input type="hidden" name="placement" value={placement} />

      <button
        type="submit"
        disabled={submitting}
        className="group mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </>
        )}
      </button>

      {errors.api && (
        <p className={errorCls} role="alert">
          {errors.api}
        </p>
      )}

      <p
        className={cn(
          'text-xs leading-relaxed',
          isDark ? 'text-white/55' : 'text-brand-deep/55',
        )}
      >
        {footnote}
      </p>
    </form>
  )
}
