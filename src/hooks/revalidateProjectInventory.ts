import { revalidatePath, revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/** Cached footer category data (src/Footer/projectCategories.ts). */
export const FOOTER_PROJECT_CATEGORIES_TAG = 'footer_project_categories'

function refresh(prefix: string, slugs: unknown[]) {
  // Local API scripts have no Next cache. Their next build reads fresh data.
  if (!process.env.NEXT_RUNTIME) return
  revalidateTag(FOOTER_PROJECT_CATEGORIES_TAG, 'max')
  // The layout invalidation includes project cards embedded in blogs and area pages.
  revalidatePath('/', 'layout')
  revalidatePath('/sitemap.xml')
  for (const slug of slugs)
    if (typeof slug === 'string' && slug) revalidatePath(`${prefix}/${slug}`)
}

export const revalidateProjectInventory: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  collection,
  context,
}) => {
  if (!context.disableRevalidate)
    refresh(collection.slug === 'marketed-projects' ? '' : '/projects', [
      doc.slug,
      previousDoc?.slug,
    ])
  return doc
}

export const revalidateDeletedProject: CollectionAfterDeleteHook = ({
  doc,
  collection,
  context,
}) => {
  if (!context.disableRevalidate)
    refresh(collection.slug === 'marketed-projects' ? '' : '/projects', [doc.slug])
  return doc
}
