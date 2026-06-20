'use client'

import { motion } from 'framer-motion'
import { Flame, Hourglass, Sparkles } from 'lucide-react'
import { cn } from '@/utilities/cn'

/**
 * Editorial "curator's plaque" badge for featured project cards.
 *
 * Design intent: gallery wall-text, not e-commerce sticker. A small navy pill
 * with a hairline gold border, a tiny accent icon, a 1px gold rule, and an
 * italic serif label — the same typographic register as the rest of the
 * Lateef Properties brand. Each tag type shares the same shape language so
 * they read as a family; only the icon + label change.
 *
 *  hot-selling       → Flame, slow ember pulse on the icon
 *  newly-launched    → Sparkles, slow twinkle
 *  limited-inventory → Hourglass, slow rotation
 */

export type HighlightTag = 'hot-selling' | 'newly-launched' | 'limited-inventory'

type Props = {
  tag: HighlightTag
  className?: string
}

const TAG_META: Record<
  HighlightTag,
  { label: string; Icon: typeof Flame; motion: 'pulse' | 'twinkle' | 'rotate' }
> = {
  'hot-selling': { label: 'Hot Selling', Icon: Flame, motion: 'pulse' },
  'newly-launched': { label: 'Newly Launched', Icon: Sparkles, motion: 'twinkle' },
  'limited-inventory': { label: 'Limited Inventory', Icon: Hourglass, motion: 'rotate' },
}

export function HighlightBadge({ tag, className }: Props) {
  const meta = TAG_META[tag]
  if (!meta) return null
  const { Icon, label, motion: kind } = meta

  return (
    <span
      className={cn(
        // Pill — deep-navy core, hairline gold border, soft gold inner glow.
        'relative inline-flex items-center gap-2 rounded-full border border-gold/40 bg-brand-deep/95 py-1.5 pl-2.5 pr-3 shadow-luxe-sm backdrop-blur-sm',
        // Subtle inset gold glow — sits behind content, never on top.
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-full',
        "before:bg-[radial-gradient(ellipse_at_left,_rgba(201,160,79,0.18),_transparent_60%)]",
        className,
      )}
    >
      {/* Icon — picks up subtle motion per tag. */}
      <motion.span
        aria-hidden
        className="relative z-10 flex items-center justify-center text-gold"
        animate={
          kind === 'pulse'
            ? { opacity: [1, 0.55, 1], scale: [1, 1.08, 1] }
            : kind === 'twinkle'
              ? { opacity: [0.7, 1, 0.7], rotate: [0, 14, 0] }
              : { rotate: [0, 180, 360] }
        }
        transition={{
          duration: kind === 'rotate' ? 12 : kind === 'twinkle' ? 3.4 : 2.6,
          repeat: Infinity,
          ease: kind === 'rotate' ? 'linear' : 'easeInOut',
        }}
      >
        <Icon className="h-3 w-3" strokeWidth={1.7} />
      </motion.span>

      {/* Hairline gold rule — the "stamp divider" that frames the label. */}
      <span aria-hidden className="relative z-10 h-3 w-px bg-gold/45" />

      {/* Label — italic serif for that wall-text editorial cadence. */}
      <span className="relative z-10 font-serif text-[0.78rem] italic leading-none tracking-tight text-gold">
        {label}
      </span>
    </span>
  )
}
