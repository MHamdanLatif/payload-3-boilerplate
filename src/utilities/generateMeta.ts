import type { Metadata } from 'next'

import type { Page, Post } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

/**
 * Metadata for the stock Payload `pages` / `posts` collections.
 *
 * These routes are NOT part of the live site — the real home page is
 * `(frontend)/page.tsx` and the real articles live in the `blogs` collection.
 * Production holds a single empty boilerplate `pages` doc and zero posts, so
 * these routes are noindexed: left indexable they compete with the real pages
 * and were emitting "| Payload Website Template" titles into search results.
 *
 * If these collections are ever put to real use, drop the `robots` block —
 * the title suffix and canonical below are already correct.
 */
export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post>
}): Promise<Metadata> => {
  const { doc } = args || {}

  const base = getServerSideURL().replace(/\/$/, '')

  const ogImage =
    typeof doc?.meta?.image === 'object' &&
    doc.meta.image !== null &&
    'url' in doc.meta.image &&
    `${base}`

  const title = doc?.meta?.title ? `${doc.meta.title} | Lateef Properties` : 'Lateef Properties'

  const slug = Array.isArray(doc?.slug) ? doc?.slug.join('/') : doc?.slug
  const path = slug && slug !== '/' ? `/${slug}` : '/'

  return {
    description: doc?.meta?.description,
    robots: { index: false, follow: false },
    alternates: { canonical: `${base}${path}` },
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: `${base}${path}`,
    }),
    title,
  }
}
