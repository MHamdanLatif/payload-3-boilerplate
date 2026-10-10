'use client'

import { Children } from 'react'
import { motion } from 'framer-motion'
import { staggerContainer, viewportOnce } from './_motion'

export function FeaturedListingsReveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial={false}
      whileInView="show"
      viewport={viewportOnce}
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${Children.count(children) > 2 ? 'lg:grid-cols-3' : ''}`}
    >
      {children}
    </motion.div>
  )
}
