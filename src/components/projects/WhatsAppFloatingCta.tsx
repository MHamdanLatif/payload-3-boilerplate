'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'

/**
 * Floating WhatsApp CTA for project landing pages.
 *
 * Design intent: NOT a green saas blob. The recognizable WhatsApp glyph sits on
 * a gold disc, set into a hairline-gold navy capsule that feels like the rest
 * of the editorial brand. A slow gold halo pulses on idle (twice every ~9s) —
 * just enough to invite a tap, never enough to nag.
 *
 * Mobile: collapses to the disc only (label hidden) so it never crowds out the
 * page on small screens.
 */

type Props = {
  projectTitle: string
  /** WhatsApp number in E.164 digits (no +). Defaults to the company line. */
  phone?: string
}

const DEFAULT_PHONE = '923363528333'

export function WhatsAppFloatingCta({ projectTitle, phone = DEFAULT_PHONE }: Props) {
  const message =
    `Hi, I'm interested in ${projectTitle}. ` +
    `Please share details on availability, pricing, and a viewing slot.`
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-5 right-5 z-50 print:hidden sm:bottom-7 sm:right-7"
    >
      <div className="relative">
        {/* Gold halo — slow, subtle. Two pulses then a long pause. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-gold/40"
          animate={{ scale: [1, 1.35, 1.55], opacity: [0.55, 0.18, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 6.4, ease: 'easeOut' }}
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-gold/25"
          animate={{ scale: [1, 1.6, 1.85], opacity: [0.35, 0.1, 0] }}
          transition={{
            duration: 3.0,
            repeat: Infinity,
            repeatDelay: 6.0,
            delay: 0.6,
            ease: 'easeOut',
          }}
        />

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Message a Lateef Properties advisor on WhatsApp about ${projectTitle}`}
          data-gtm="whatsapp-fab"
          className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-gold/45 bg-brand-deep/95 py-2.5 pl-2.5 pr-2.5 text-ivory shadow-luxe-sm backdrop-blur-xl transition-[border-color,background-color,box-shadow,padding] duration-500 hover:border-gold hover:bg-brand-deep hover:shadow-luxe hover:pr-5 sm:py-3 sm:pl-3"
        >
          {/* Sheen — single sweep on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-gold/15 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100"
          />

          {/* Icon disc — gold ground holds the WhatsApp glyph in navy. */}
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-brand-deep shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)] transition-transform duration-500 group-hover:rotate-[-4deg] group-hover:scale-[1.04] sm:h-10 sm:w-10">
            <WhatsAppIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          </span>

          {/* Two-line label — hidden on mobile so the FAB collapses to disc only. */}
          <span className="hidden flex-col items-start gap-0.5 pr-1 leading-none sm:flex">
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.32em] text-gold">
              Speak to an advisor
            </span>
            <span className="font-serif text-[0.95rem] tracking-tight text-ivory">
              on WhatsApp
            </span>
          </span>

          {/* Arrow — slides in on hover. */}
          <ArrowUpRight
            aria-hidden
            className="hidden h-3.5 w-3.5 -translate-x-2 text-gold opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100 sm:block"
            strokeWidth={1.75}
          />
        </a>
      </div>
    </motion.div>
  )
}
