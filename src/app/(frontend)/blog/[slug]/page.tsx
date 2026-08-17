import type { Metadata } from 'next'
import type { FeaturedProject, PropertyListing } from '@/payload-types'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  fetchBlogBySlug,
  fetchPublishedBlogSlugs,
  fetchRelatedProjects,
  fetchRelatedListings,
  blogImage,
  formatBlogDate,
} from '@/lib/blogs'
import { articleSchema, breadcrumbListSchema } from '@/lib/seo-jsonld'
import { JsonLd } from '@/components/shared/JsonLd'
import { FeaturedProjectCard } from '@/components/landing/FeaturedProjectCard'
import { PropertyListingCard } from '@/components/landing/PropertyListingCard'
import RichText from '@/components/RichText'
import { getServerSideURL } from '@/utilities/getURL'

type Params = { slug: string }

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const slugs = await fetchPublishedBlogSlugs(payload)
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config })
  const blog = await fetchBlogBySlug(payload, slug)
  if (!blog) return { title: 'Article not found | Lateef Properties' }

  const seoTitle = blog.meta?.title ?? `${blog.title} | Lateef Properties`
  const seoDescription = blog.meta?.description ?? blog.excerpt ?? ''
  const ogImage =
    (typeof blog.meta?.image === 'object' && blog.meta?.image?.url) ||
    blogImage(blog) ||
    undefined
  const canonical = `${getServerSideURL()}/blog/${blog.slug}`
  const keywords = (blog.keywords ?? [])
    .map((k) => k.keyword)
    .filter((k): k is string => Boolean(k))

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: { canonical },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: canonical,
      type: 'article',
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: 'Lateef Properties',
      publishedTime: blog.publishedAt ?? blog.createdAt,
      modifiedTime: blog.updatedAt ?? blog.publishedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      images: ogImage ? [ogImage] : undefined,
    },
    keywords,
  }
}

export const dynamicParams = true
export const revalidate = 60

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const blog = await fetchBlogBySlug(payload, slug)
  if (!blog) notFound()

  const base = getServerSideURL().replace(/\/$/, '')
  const canonical = `${base}/blog/${blog.slug}`
  const hero = blogImage(blog)

  // "Featured for you" cards at the end of the post. Editorial picks from the
  // CMS (`featuredCards`) win; if none are set, auto-select by what the article
  // is about (projects by name match, listings by topic match). Relationships
  // are populated because the blog is fetched at depth 2.
  const manualProjects = (blog.featuredCards ?? [])
    .filter((c) => c.cardType === 'project' && c.targetProject && typeof c.targetProject === 'object')
    .map((c) => c.targetProject as FeaturedProject)
  const manualListings = (blog.featuredCards ?? [])
    .filter((c) => c.cardType === 'listing' && c.targetListing && typeof c.targetListing === 'object')
    .map((c) => c.targetListing as PropertyListing)

  let projectCards: FeaturedProject[]
  let listingCards: PropertyListing[]
  if (manualProjects.length > 0 || manualListings.length > 0) {
    projectCards = manualProjects
    listingCards = manualListings
  } else {
    const [rp, rl] = await Promise.all([
      fetchRelatedProjects(payload, blog, 2),
      fetchRelatedListings(payload, blog, 2),
    ])
    projectCards = rp.slice(0, 2)
    listingCards = rl.slice(0, Math.max(0, 3 - projectCards.length))
  }
  const hasCards = projectCards.length > 0 || listingCards.length > 0

  const schemas = [
    articleSchema(blog),
    breadcrumbListSchema([
      { name: 'Home', url: `${base}/` },
      { name: 'Blogs', url: `${base}/blog` },
      { name: blog.title, url: canonical },
    ]),
  ]

  return (
    <>
      <JsonLd data={schemas} />
      <article className="bg-ivory pb-24 pt-32 md:pb-32 md:pt-40">
        <div className="container max-w-4xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep/65 transition-colors hover:text-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Blog
          </Link>

          <header className="mt-8">
            <div className="flex flex-wrap items-center gap-3 text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep/55">
              <span>{formatBlogDate(blog.publishedAt)}</span>
              {blog.readTime && (
                <>
                  <span aria-hidden>·</span>
                  <span>{blog.readTime} min read</span>
                </>
              )}
            </div>
            <h1 className="mt-6 font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-[3.5rem]">
              {blog.title}
            </h1>
            {blog.excerpt && (
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-brand-deep/75 text-pretty">
                {blog.excerpt}
              </p>
            )}
          </header>

          {hero && (
            <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-3xl shadow-luxe">
              <Image
                src={hero}
                alt={blog.title}
                fill
                priority
                sizes="(min-width: 1024px) 900px, 100vw"
                className="object-cover"
              />
            </div>
          )}

          {/*
            Inventory route ABOVE the article body.

            The card grid at the foot of the page sits after the full guide, so
            a visitor arriving from search has to read to the end to find any
            property. These posts rank at positions 6-9 for transactional
            queries ("duplex", "scheme 33") and convert at 0.5-0.7% — the reader
            wants inventory, not an essay, and was being made to earn it.

            Deliberately a compact text strip rather than a second card grid:
            it must not push the article itself below the fold, and it reuses
            the already-resolved cards so there is no extra query.
          */}
          {hasCards && (
            <div className="mt-10 rounded-xl border border-gold/30 bg-gold/[0.06] px-5 py-4">
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-brand-deep/55">
                Available now
              </p>
              <p className="mt-2 text-sm leading-relaxed text-brand-deep/80">
                {'Looking to buy rather than read? '}
                {[
                  ...projectCards.map((p) => ({
                    key: `project-${p.id}`,
                    href: `/projects/${p.slug}`,
                    title: p.title,
                  })),
                  ...listingCards.map((l) => ({
                    key: `listing-${l.id}`,
                    href: `/listings/${l.slug}`,
                    title: l.title,
                  })),
                ].map((item, i, arr) => (
                  <span key={item.key}>
                    <Link
                      href={item.href}
                      className="font-medium text-gold underline underline-offset-4 hover:text-brand-deep"
                    >
                      {item.title}
                    </Link>
                    {i < arr.length - 1 ? ', ' : ''}
                  </span>
                ))}
                {' — or '}
                <Link
                  href="/properties"
                  className="text-gold underline underline-offset-4 hover:text-brand-deep"
                >
                  browse all Karachi inventory
                </Link>
                .
              </p>
            </div>
          )}

          <div className="prose prose-lg mt-12 max-w-none text-brand-deep/85 [&_h2]:font-serif [&_h2]:text-brand-deep [&_h2]:tracking-tight [&_h2]:mt-12 [&_h3]:font-serif [&_h3]:text-brand-deep [&_h3]:mt-8 [&_a]:text-gold [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-gold-hover [&_strong]:text-brand-deep">
            <RichText
              content={blog.content as Record<string, unknown>}
              enableGutter={false}
              enableProse={false}
            />
          </div>

          {hasCards && (
            <section className="mt-16">
              <p className="eyebrow text-gold">Featured for you</p>
              <h2 className="mt-3 font-serif text-2xl tracking-tight text-brand-deep md:text-3xl">
                Properties mentioned in this guide.
              </h2>
              <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                {projectCards.map((p) => (
                  <FeaturedProjectCard key={`project-${p.id}`} project={p} />
                ))}
                {listingCards.map((l) => (
                  <PropertyListingCard key={`listing-${l.id}`} listing={l} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-16 rounded-2xl border border-brand-deep/10 bg-white p-8 text-center shadow-luxe-sm md:p-10">
            <p className="eyebrow text-gold">Ready to act on this?</p>
            <h2 className="mt-3 font-serif text-2xl tracking-tight text-brand-deep md:text-3xl">
              Browse curated Karachi inventory.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-brand-deep/70">
              Filter pre-launch developments and ready-to-move listings by location,
              type and budget — or have a senior advisor source what isn&rsquo;t listed.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/properties"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold hover:text-brand-deep"
              >
                Browse properties
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="/#contact"
                className="inline-flex items-center gap-2 rounded-full border border-brand-deep/25 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep transition-all duration-300 hover:border-brand-deep hover:bg-brand-deep hover:text-white"
              >
                Talk to an advisor
              </Link>
            </div>
          </div>
        </div>
      </article>
    </>
  )
}
