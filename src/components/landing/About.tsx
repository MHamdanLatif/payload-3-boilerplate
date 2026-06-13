'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { ShieldCheck, Zap, Compass } from 'lucide-react'
import { SectionRule } from './SectionRule'
import { fadeUp, staggerContainer, viewportOnce } from './_motion'

const STATS = [
  {
    icon: ShieldCheck,
    value: 'Karachi',
    label: 'Coverage',
    detail:
      'Apartments, plots, offices and shops across Gulshan-e-Iqbal, Gulistan-e-Jauhar, Scheme 33, DHA, Clifton, M.A. Jinnah Road, Jinnah Avenue and Malir.',
  },
  {
    icon: Zap,
    value: '<24h',
    label: 'Advisor Callback',
    detail:
      'Speak to a Karachi-based advisor on WhatsApp — usually the same hour you write in.',
  },
  {
    icon: Compass,
    value: 'Off-Market',
    label: 'Hidden Listings',
    detail:
      'Pre-launch allocations and resale deals across Karachi that don’t hit public portals.',
  },
]

export function About() {
  return (
    <section id="about" className="relative bg-cream py-24 md:py-32">
      {/* Editorial side numerals */}
      <div className="pointer-events-none absolute right-6 top-12 hidden font-mono text-[0.7rem] tracking-[0.3em] text-brand/55 md:block">
        04 / EDGE
      </div>

      <div className="container">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-12">
          {/* Image collage */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="relative lg:col-span-5"
          >
            <motion.div
              variants={fadeUp}
              className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-luxe"
            >
              <Image
                src="/landing/karachi-skyline.jpg"
                alt="Gulshan-e-Iqbal apartment towers at twilight — Karachi residential skyline"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand/40 to-transparent" />
              <div className="absolute bottom-5 left-5 text-ivory">
                <p className="eyebrow text-gold-soft">Operating In</p>
                <p className="font-serif text-xl">Karachi</p>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="absolute -bottom-10 -right-4 hidden w-52 rounded-2xl bg-brand p-5 text-ivory shadow-luxe sm:block lg:-right-8 lg:w-60"
            >
              <p className="eyebrow text-gold">Karachi Developments</p>
              <div className="my-3 h-px w-full bg-ivory/15" />
              <p className="text-xs leading-relaxed text-ivory/85">
                Pre-launch, under-construction and ready-for-possession projects
                across Karachi&rsquo;s most active corridors.
              </p>
            </motion.div>
          </motion.div>

          {/* Copy column */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="lg:col-span-7 lg:pl-6"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold md:hidden">
                04 / EDGE
              </span>
              <span className="h-px w-10 bg-gold" />
              <span className="eyebrow text-brand/75">What we do differently</span>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="mt-6 font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-[3.5rem]"
            >
              Karachi real estate, sourced the{' '}
              <span className="italic text-gold">modern</span> way.
            </motion.h2>
            <motion.div variants={fadeUp}>
              <SectionRule className="mt-6" />
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 space-y-5 text-base leading-relaxed text-brand/75 md:text-lg">
              <p>
                Lateef Properties is the authorised marketing agency for Karachi
                apartments, plots and commercial property. We move pre-launch
                allocations on partner developments and off-market resale across
                Gulshan-e-Iqbal, Gulistan-e-Jauhar, Scheme 33, DHA, Clifton,
                M.A. Jinnah Road, Jinnah Avenue and Malir.
              </p>
              <p>
                We work with first-time buyers, returning expatriates and investors
                building rental yield in Karachi. Every match is sized to your
                budget and timeline, with comparables you can see and a transparent
                fee — never a pushed listing.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={staggerContainer}
              className="mt-14 grid grid-cols-1 gap-px rounded-2xl bg-border sm:grid-cols-3"
            >
              {STATS.map(({ icon: Icon, value, label, detail }) => (
                <motion.div
                  key={label}
                  variants={fadeUp}
                  className="flex flex-col gap-3 bg-cream p-6 first:rounded-t-2xl last:rounded-b-2xl sm:first:rounded-l-2xl sm:first:rounded-tr-none sm:last:rounded-r-2xl sm:last:rounded-bl-none"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-gold" strokeWidth={1.5} />
                    <span className="font-mono text-[0.6rem] tracking-[0.3em] text-gold/70">
                      ●
                    </span>
                  </div>
                  <p className="font-serif text-3xl text-brand-deep md:text-4xl">{value}</p>
                  <div>
                    <p className="text-sm font-medium text-brand-deep">{label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-brand/70">
                      {detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
