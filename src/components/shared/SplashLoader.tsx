'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const STORAGE_KEY = 'lateef:splash-seen'
const VISIBLE_MS = 1500

export function SplashLoader() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let timeout: ReturnType<typeof setTimeout> | null = null
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return
      setShow(true)
      sessionStorage.setItem(STORAGE_KEY, '1')
      // Lock body scroll while the splash is visible.
      document.documentElement.style.overflow = 'hidden'
      timeout = setTimeout(() => setShow(false), VISIBLE_MS)
    } catch {
      // sessionStorage blocked (e.g. third-party context). Just skip the splash.
    }
    return () => {
      if (timeout) clearTimeout(timeout)
      document.documentElement.style.overflow = ''
    }
  }, [])

  return (
    <AnimatePresence
      onExitComplete={() => {
        document.documentElement.style.overflow = ''
      }}
    >
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-brand-gradient text-white"
          aria-hidden
        >
          {/* Decorative atmosphere */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--gold)/0.15),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

          {/* Top eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-3"
          >
            <span className="h-px w-10 bg-gold" />
            <span className="eyebrow text-gold">Karachi</span>
            <span className="h-px w-10 bg-gold" />
          </motion.div>

          {/* Brand wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-baseline gap-3 px-6"
          >
            <span className="font-serif text-4xl tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Lateef
            </span>
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6, type: 'spring', bounce: 0.5 }}
              className="h-2 w-2 translate-y-[-2px] rounded-full bg-gold md:h-2.5 md:w-2.5"
            />
            <span className="font-serif text-4xl tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Properties
            </span>
          </motion.div>

          {/* Bottom indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-1 w-32 overflow-hidden rounded-full bg-white/15">
                <motion.span
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{
                    duration: 1.1,
                    ease: 'easeInOut',
                    repeat: Infinity,
                  }}
                  className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gold"
                />
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
