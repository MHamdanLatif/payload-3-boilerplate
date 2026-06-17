'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
// Validation helper is tiny — keep static so submit can validate without
// waiting for the dynamic component chunk to load.
import { isPossiblePhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import '@/styles/phone-input.css'
import { ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/utilities/cn'

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
export type LeadFormSourceKind = 'project' | 'listing' | 'location' | 'payment-plan'

type Props = {
  sourceName: string
  sourceSlug: string
  sourceKind: LeadFormSourceKind
  placement?: LeadFormPlacement
  tone?: 'light' | 'dark'
  submitLabel?: string
  footnote?: string
  onSuccess?: () => void
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
}: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState<string | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; api?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  const isDark = tone === 'dark'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!name.trim() || name.trim().length < 2) errs.name = 'Please share your full name.'
    if (!phone) errs.phone = 'Phone number is required.'
    else if (!isPossiblePhoneNumber(phone)) errs.phone = 'Phone number looks incomplete.'
    if (email && !EMAIL_RE.test(email)) errs.email = 'Email looks invalid.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
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
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setErrors({ api: j.error ?? "Couldn't send right now. Please try again or WhatsApp us." })
        setSubmitting(false)
        return
      }
      onSuccess?.()
      router.push(`/thank-you?source=${sourceKind}:${encodeURIComponent(sourceSlug)}`)
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
