import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { Blog } from '@/payload-types'
import { BlogCard } from './BlogCard'
import { SectionRule } from '@/components/landing/SectionRule'

/**
 * Shared "articles" strip — renders a heading + a grid of BlogCards. Used for
 * the homepage "Latest insights" section and the related-article blocks on
 * location/project pages, so every published post earns internal links *in*.
 * Renders nothing when there are no posts to show.
 */
export function InsightsSection({
  blogs,
  eyebrow,
  heading,
  intro,
  bg = 'bg-ivory',
  showViewAll = true,
}: {
  blogs: Blog[]
  eyebrow: string
  heading: string
  intro?: string
  bg?: string
  showViewAll?: boolean
}) {
  if (!blogs.length) return null

  return (
    <section className={`${bg} py-20 md:py-28`}>
      <div className="container">
        <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">{eyebrow}</span>
        <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep md:text-5xl">
          {heading}
        </h2>
        <SectionRule className="mt-6" />
        {intro && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-brand-deep/70 md:text-lg">
            {intro}
          </p>
        )}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
        {showViewAll && (
          <div className="mt-10">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep transition-colors hover:text-gold"
            >
              View all articles
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
