import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

import { fetchPublishedBlogs } from '@/lib/blogs'
import { breadcrumbListSchema } from '@/lib/seo-jsonld'
import { JsonLd } from '@/components/shared/JsonLd'
import { BlogCard } from '@/components/blog/BlogCard'
import { SectionRule } from '@/components/landing/SectionRule'
import { getServerSideURL } from '@/utilities/getURL'

const base = getServerSideURL().replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Karachi Real Estate Blog | Lateef Properties',
  description:
    'Investor guides, market trends and buyer playbooks for Karachi real estate — written for first-time buyers, returning expatriates, and seasoned investors.',
  alternates: { canonical: `${base}/blog` },
  openGraph: {
    title: 'Karachi Real Estate Blog | Lateef Properties',
    description:
      'Investor guides, market trends and buyer playbooks for Karachi real estate.',
    url: `${base}/blog`,
    type: 'website',
    siteName: 'Lateef Properties',
  },
  keywords: [
    'Karachi real estate blog',
    'Pakistan property guide',
    'Karachi investor guide',
    'property trends Karachi',
    'Karachi real estate articles',
    'Lateef Properties',
  ],
}

export const dynamic = 'force-dynamic'

export default async function BlogIndexPage() {
  const payload = await getPayload({ config })
  const blogs = await fetchPublishedBlogs(payload, 50)

  const breadcrumb = breadcrumbListSchema([
    { name: 'Home', url: `${base}/` },
    { name: 'Blogs', url: `${base}/blog` },
  ])

  return (
    <>
      <JsonLd data={breadcrumb} />
      <main className="bg-ivory pb-24 pt-32 md:pb-32 md:pt-40">
        <div className="container">
          <div className="mb-12 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                BLOGS
              </span>
              <span className="h-px w-10 bg-gold" />
            </div>
            <h1 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-6xl">
              Karachi real estate,{' '}
              <span className="italic text-gold">unpacked.</span>
            </h1>
            <SectionRule className="mt-6" />
            <p className="mt-6 text-base leading-relaxed text-brand-deep/70 md:text-lg">
              Investor guides, market trends and buyer playbooks for Karachi — written
              for first-time buyers, returning expatriates and seasoned investors.
            </p>
          </div>

          {blogs.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {blogs.map((blog) => (
                <BlogCard key={blog.id} blog={blog} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-brand-deep/15 bg-white px-8 py-16 text-center">
              <p className="eyebrow text-gold">Blog</p>
              <h2 className="mt-3 font-serif text-2xl text-brand-deep md:text-3xl">
                New articles landing soon.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-deep/65">
                We&rsquo;re drafting the first set of guides. Check back in a few days.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
