'use client'

import { motion } from 'framer-motion'
import { Home, Building2, TrendingUp, ArrowUpRight } from 'lucide-react'
import { SectionRule } from './SectionRule'
import { fadeUp, staggerContainer, viewportOnce } from './_motion'

const SERVICES = [
  {
    icon: Home,
    label: 'Residential Sales',
    title: 'Apartments and duplexes across Karachi.',
    body: 'Flats and duplex apartments in Gulshan-e-Iqbal, Gulistan-e-Jauhar, Scheme 33, DHA, Clifton, M.A. Jinnah Road, Jinnah Avenue and Malir — pre-launch, under-construction and ready-to-move.',
    bullets: ['Pre-launch allocations', 'Installment plan support', 'Possession & handover assistance'],
  },
  {
    icon: Building2,
    label: 'Commercial Property',
    title: 'Offices and shops for sale in Karachi.',
    body: 'Plug-and-play offices, retail shops and commercial plots on M.A. Jinnah Road, Jinnah Avenue, DHA, Clifton, Scheme 33 and Gulshan-e-Iqbal. Bought, leased and negotiated end-to-end.',
    bullets: ['Plug-and-play offices', 'Retail shops & plazas', 'Lease negotiation'],
  },
  {
    icon: TrendingUp,
    label: 'Investment Deals',
    title: 'Pre-launch allocations and off-market deals.',
    body: 'Allocations on new pre-launch projects, off-market resale in DHA and Clifton, and yield-focused commercial property across Karachi.',
    bullets: ['Pre-launch allocations', 'Off-market resale', 'Rental yield deals'],
  },
]

export function Services() {
  return (
    <section id="services" className="relative bg-ivory py-24 md:py-32">
      <div className="container">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mb-16 max-w-3xl"
        >
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              05 / PRACTICE
            </span>
            <span className="h-px w-10 bg-gold" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-6xl"
          >
            What we sell in{' '}
            <span className="italic text-gold">Karachi.</span>
          </motion.h2>
          <motion.div variants={fadeUp}>
            <SectionRule className="mt-6" />
          </motion.div>
          <motion.p variants={fadeUp} className="mt-6 text-base leading-relaxed text-brand/70 md:text-lg">
            Apartments, commercial property and investment deals across Karachi.
            First home, flagship office or growing rental portfolio — same
            playbook, same advisor.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="grid grid-cols-1 gap-px rounded-2xl bg-border md:grid-cols-3"
        >
          {SERVICES.map(({ icon: Icon, label, title, body, bullets }, i) => (
            <motion.div
              key={label}
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
                <p className="eyebrow text-gold">{label}</p>
                <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-brand md:text-[1.65rem]">
                  {title}
                </h3>
                <p
                  className="mt-4 text-sm leading-relaxed text-brand/70"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              </div>

              <ul className="mt-auto space-y-2 border-t border-dashed border-border pt-5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm text-brand/75">
                    <span className="h-1 w-1 rounded-full bg-gold" />
                    {b}
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className="inline-flex items-center gap-1.5 self-start text-xs font-medium uppercase tracking-[0.2em] text-brand transition-colors duration-300 hover:text-gold"
              >
                Speak to an advisor
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
