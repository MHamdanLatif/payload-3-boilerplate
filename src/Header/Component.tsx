'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, ArrowUpRight, Search } from 'lucide-react'
import { cn } from '@/utilities/cn'

type NavItem = { label: string; href: string; n: string; external?: boolean }

const NAV_ITEMS: NavItem[] = [
  { label: 'About', href: '/#about', n: '01' },
  { label: 'Properties', href: '/properties', n: '02' },
  { label: 'Blogs', href: '/blog', n: '03' },
  { label: 'Services', href: '/#services', n: '04' },
  { label: 'Builder', href: 'https://www.lateefbuilders.pk/', n: '05', external: true },
  { label: 'Contact', href: '/#contact', n: '06' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500',
          scrolled
            ? 'bg-ivory/85 shadow-[0_2px_24px_-12px_rgba(47,53,88,0.18)] backdrop-blur-md'
            : 'bg-transparent',
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 h-px transition-opacity duration-500',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden
        >
          <div className="h-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>

        <div className="container flex h-20 items-center justify-between">
          <Link
            href="/"
            className="group flex items-baseline gap-2"
            aria-label="Lateef Properties home"
          >
            <span
              className={cn(
                'font-serif text-2xl tracking-tight transition-colors duration-500',
                scrolled ? 'text-brand-deep' : 'text-white',
              )}
            >
              Lateef
            </span>
            <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-gold transition-transform duration-300 group-hover:scale-150" />
            <span
              className={cn(
                'font-serif text-2xl tracking-tight transition-colors duration-500',
                scrolled ? 'text-brand-deep' : 'text-white',
              )}
            >
              Properties
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={cn(
                  'group relative px-3 py-2 text-sm transition-colors duration-300',
                  scrolled
                    ? 'text-brand-deep/75 hover:text-brand-deep'
                    : 'text-white/80 hover:text-white',
                )}
              >
                <span className="absolute left-3 top-1 font-mono text-[0.55rem] tracking-[0.3em] text-gold/0 transition-colors duration-300 group-hover:text-gold">
                  {item.n}
                </span>
                <span className="relative inline-flex items-center gap-1">
                  {item.label}
                  {item.external && (
                    <ArrowUpRight className="h-3 w-3 opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
                  )}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/properties"
              aria-label="Search properties"
              className={cn(
                'hidden h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 md:flex',
                scrolled
                  ? 'border-brand-deep/15 text-brand-deep hover:border-gold hover:text-gold'
                  : 'border-white/30 text-white hover:border-gold hover:text-gold',
              )}
            >
              <Search className="h-4 w-4" />
            </Link>

            <a
              href="/#contact"
              className="group relative hidden overflow-hidden rounded-full bg-gold px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep shadow-[0_8px_20px_-10px_rgba(227,176,75,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover hover:shadow-gold md:inline-flex md:items-center md:gap-2"
            >
              <span className="relative z-10">Book a Consultation</span>
              <ArrowUpRight className="relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>

            <button
              onClick={() => setOpen(true)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 md:hidden',
                scrolled
                  ? 'border-brand-deep/15 text-brand-deep hover:border-gold hover:text-gold'
                  : 'border-white/30 text-white hover:border-gold hover:text-gold',
              )}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] md:hidden"
          >
            <button
              aria-label="Close menu backdrop"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-brand-deep/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-brand-gradient text-white"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <span className="eyebrow text-gold">Lateef Properties</span>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-gold hover:text-gold"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex flex-col px-6 py-8">
                {NAV_ITEMS.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 + i * 0.06 }}
                  >
                    <Link
                      href={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noopener noreferrer' : undefined}
                      onClick={() => setOpen(false)}
                      className="group flex items-baseline justify-between border-b border-white/10 py-5"
                    >
                      <span className="inline-flex items-baseline gap-2 font-serif text-3xl tracking-tight text-white transition-colors group-hover:text-gold">
                        {item.label}
                        {item.external && <ArrowUpRight className="h-4 w-4 opacity-70" />}
                      </span>
                      <span className="font-mono text-[0.65rem] tracking-[0.3em] text-white/40">
                        {item.n}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-auto border-t border-white/10 px-6 py-6"
              >
                <a
                  href="/#contact"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep shadow-gold transition-colors hover:bg-gold-hover"
                >
                  Book a Consultation
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <p className="mt-5 text-center text-xs text-white/55">
                  +92-3363-LATEEF · Karachi
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer so content doesn't hide under the fixed header on routes without a hero */}
      <div className="h-0" aria-hidden />
    </>
  )
}
