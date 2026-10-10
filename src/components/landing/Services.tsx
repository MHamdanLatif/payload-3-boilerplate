'use client'

import { motion } from 'framer-motion'
import { Home, Building2, TrendingUp, ArrowUpRight } from 'lucide-react'
import { SectionRule } from './SectionRule'
import { fadeUp, staggerContainer, viewportOnce } from './_motion'

const SERVICES = [
  {
    icon: Home,
    title: 'Find the Right Project',
    body: 'Tell us your preferred location, budget and whether you’re buying for your own use or investment. We’ll help you shortlist suitable options.',
  },
  {
    icon: Building2,
    title: 'Compare Layouts & Payment Options',
    body: 'Review available unit types, booking amounts and payment schedules, with a clear explanation of the payment commitments.',
  },
  {
    icon: TrendingUp,
    title: 'Arrange a Visit & Book',
    body: 'Visit shortlisted projects, discuss unit availability and get assistance with the booking process and coordination with the developer.',
  },
]

export function Services() {
  return (
    <section id="services" className="relative bg-ivory py-24 md:py-32">
      <div className="container">
        <motion.div
          variants={staggerContainer}
          initial={false}
          whileInView="show"
          viewport={viewportOnce}
          className="mb-16 max-w-3xl"
        >
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">SERVICES</span>
            <span className="h-px w-10 bg-gold" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-6xl"
          >
            Support at every step of your <span className="italic text-gold">property search.</span>
          </motion.h2>
          <motion.div variants={fadeUp}>
            <SectionRule className="mt-6" />
          </motion.div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial={false}
          whileInView="show"
          viewport={viewportOnce}
          className="grid grid-cols-1 gap-px rounded-2xl bg-border md:grid-cols-3"
        >
          {SERVICES.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="group relative flex flex-col gap-6 bg-white p-8 transition-colors duration-500 hover:bg-cream md:p-10
                first:rounded-t-2xl last:rounded-b-2xl
                md:first:rounded-l-2xl md:first:rounded-tr-none md:last:rounded-r-2xl md:last:rounded-bl-none"
            >
              <div className="flex items-start justify-between">
                <div className="relative">
                  <span className="absolute -inset-2 rounded-full bg-gold/15 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <span className="font-mono text-[0.65rem] tracking-[0.3em] text-brand/55">
                  0{i + 1}
                </span>
              </div>

              <div>
                <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-brand md:text-[1.65rem]">
                  {title}
                </h3>
                <p
                  className="mt-4 text-sm leading-relaxed text-brand/70"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              </div>

              <a
                href="#contact"
                className="inline-flex items-center gap-1.5 mt-auto self-start text-xs font-medium uppercase tracking-[0.2em] text-brand transition-colors duration-300 hover:text-gold"
              >
                Talk to an Advisor
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
