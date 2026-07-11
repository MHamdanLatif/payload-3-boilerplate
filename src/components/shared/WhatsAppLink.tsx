'use client'

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { trackLead } from '@/lib/analytics'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /**
   * Context slug for GA4 segmentation (e.g. a project slug). Defaults to
   * 'global' for site-wide entry points like the footer button.
   */
  project?: string
  children: ReactNode
}

/**
 * Drop-in replacement for an `<a>` that points at WhatsApp. On click it fires
 * the SAME `generate_lead` GA4 event as the forms (via trackLead), tagged
 * `form_name: 'whatsapp'` so WhatsApp taps count in the one conversion number
 * while staying segmentable.
 *
 * The click behaviour is unchanged: trackLead is fire-and-forget and SSR-safe,
 * and we never preventDefault or delay — so the chat opens exactly as before,
 * new tab or same tab. Use this instead of a raw `<a href="https://wa.me/…">`
 * anywhere on the site so new WhatsApp links are tracked automatically.
 */
export function WhatsAppLink({ project = 'global', onClick, children, ...rest }: Props) {
  return (
    <a
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        trackLead({ form_name: 'whatsapp', project })
        onClick?.(e)
      }}
    >
      {children}
    </a>
  )
}
