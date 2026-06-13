import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { Blog } from '@/payload-types'
import { blogImage, formatBlogDate } from '@/lib/blogs'

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1400&q=80&auto=format&fit=crop'

export function BlogCard({ blog }: { blog: Blog }) {
  const src = blogImage(blog) ?? PLACEHOLDER
  const href = `/blog/${blog.slug}`

  return (
    <Link
      href={href}
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-luxe-sm ring-1 ring-border/60 transition-all duration-500 hover:-translate-y-1 hover:shadow-luxe"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={src}
          alt={blog.title}
          fill
          sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/40 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55">
          <span>{formatBlogDate(blog.publishedAt)}</span>
          {blog.readTime && (
            <>
              <span aria-hidden>·</span>
              <span>{blog.readTime} min read</span>
            </>
          )}
        </div>

        <h3 className="font-serif text-2xl leading-tight tracking-tight text-brand-deep line-clamp-3">
          {blog.title}
        </h3>

        {blog.excerpt && (
          <p className="text-sm leading-relaxed text-brand-deep/70 line-clamp-3">
            {blog.excerpt}
          </p>
        )}

        <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep/70 transition-colors group-hover:text-gold">
          Read article
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  )
}
