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
          initial="hidden"
          animate="show"
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          {/* Eyebrow */}
          <motion.div
            variants={fadeUp}
            className="mb-8 flex items-center gap-3"
          >
            <span className="h-px w-10 bg-gold" />
            <span className="eyebrow text-gold">Pre-Launch · Ready to Move · Off-Market Inventory</span>
            <span className="h-px w-10 bg-gold" />
          </motion.div>

          {/* Logo */}
          <motion.div variants={fadeUp} className="mb-8">
            <Image
              src="/brand/lateef-logo.png"
              alt="Lateef Properties"
              width={190}
              height={190}
              priority
              className="h-auto w-[140px] transition-transform duration-500 hover:scale-105 md:w-[180px] lg:w-[200px]"
            />
          </motion.div>

          {/* H1 */}
          <motion.h1
            variants={fadeUp}
            className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-[5rem]"
          >
            Lateef Properties
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-lg leading-relaxed text-white/95 md:text-xl"
          >
            Karachi apartments, plots and commercial property.
          </motion.p>

          {/* Authority line */}
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 md:text-base"
          >
            Authorised marketing agency for Karachi&rsquo;s leading developers.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4"
          >
            <a
              href="#listings"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gold px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover hover:shadow-luxe"
            >
              <span className="relative z-10">Explore Listings</span>
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
              Talk to an Expert
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </motion.div>
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
