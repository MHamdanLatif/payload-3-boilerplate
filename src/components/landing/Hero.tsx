'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowDown } from 'lucide-react'
import { fadeUp, staggerContainer } from './_motion'

export function Hero() {
  return (
    <section
      id="home"
      className="relative isolate flex min-h-[92vh] items-center justify-center overflow-hidden text-white grain"
    >
      {/* Brand gradient background — old-site #2f3558 → #3e4a89 → #545fa5 */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-gradient" />

      {/* Subtle radial glow + faint architectural grid + bottom fade */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.10),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(47,53,88,0.7),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </div>

      <div className="container relative w-full pb-24 pt-32 md:pb-32 md:pt-36">
        <motion.div
          variants={staggerContainer}
          initial={false}
          animate="show"
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp} className="mb-8 flex max-w-full items-center gap-3">
            <span className="h-px w-5 shrink-0 bg-gold sm:w-10" />
            <span className="eyebrow text-gold">
              PRE-LAUNCH · UNDER CONSTRUCTION · READY TO MOVE
            </span>
            <span className="h-px w-5 shrink-0 bg-gold sm:w-10" />
          </motion.div>

          {/* Keep the logo, heading and buyer actions visible in the server HTML. */}

          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/brand/lateef-logo.png"
              alt="Lateef Properties"
              width={190}
              height={190}
              priority
              className="h-auto w-[140px] transition-transform duration-500 hover:scale-105 md:w-[180px] lg:w-[200px]"
            />
          </div>

          {/* H1 — the commercial phrase, not the brand name. The brand is
              carried by the logo directly above and the site-wide Organization
              schema; an <h1> of "Lateef Properties" told Google nothing about
              what this page sells. */}
          <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-[4.5rem]">
            Explore Property Projects in Karachi
          </h1>

          {/* Subtext */}
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/95 md:text-xl">
            Find a home or investment that fits your budget. Explore apartments and commercial
            properties, compare prices, floor plans and payment options, and get clear guidance from
            enquiry to booking.
          </p>

          {/* Authority line */}
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">
            Your Partner in Property &amp; Prosperity.
          </p>

          {/* CTAs — also un-wrapped: this is the primary conversion path and
              should not wait on hydration to become visible. */}
          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <a
              href="#projects"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gold px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover hover:shadow-luxe"
            >
              <span className="relative z-10">Explore Projects</span>
              <ArrowDown className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
            </a>
            <a
              href="#contact"
              className="group inline-flex items-center justify-center gap-2 rounded-full border-[1.8px] border-white/60 bg-transparent px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
            >
              Talk to an Advisor
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2"
        aria-hidden
      >
        <span className="flex h-9 w-5 items-start justify-center rounded-full border border-white/30 pt-1.5">
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="h-1.5 w-1 rounded-full bg-white/60"
          />
        </span>
      </motion.div>
    </section>
  )
}
