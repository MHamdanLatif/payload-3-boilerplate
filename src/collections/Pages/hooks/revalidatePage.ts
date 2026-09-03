import type { CollectionAfterChangeHook } from 'payload'

import { revalidatePath } from 'next/cache'

import type { Page } from '../../../payload-types'

// These pages render at /pages/<slug>, not /<slug>: the root segment now belongs
// to the paid landing pages. The `home` special-case is kept because the real
// home page at `/` would still need revalidating if this collection were ever
// wired up to it.
const pagePath = (slug: string | null | undefined): string =>
  slug === 'home' ? '/' : `/pages/${slug}`

export const revalidatePage: CollectionAfterChangeHook<Page> = ({
  doc,
  previousDoc,
  req: { payload },
}) => {
  if (doc._status === 'published') {
    const path = pagePath(doc.slug)

    payload.logger.info(`Revalidating page at path: ${path}`)

    revalidatePath(path)
  }

  // If the page was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    const oldPath = pagePath(previousDoc.slug)

    payload.logger.info(`Revalidating old page at path: ${oldPath}`)

    revalidatePath(oldPath)
  }

  return doc
}
