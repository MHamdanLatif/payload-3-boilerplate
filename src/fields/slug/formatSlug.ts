import type { FieldHook } from 'payload'

export const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    // Collapse runs of hyphens (e.g. from " - " or "/" in a title) to one, and
    // trim any leading/trailing hyphens so slugs never contain "--" or dangle.
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

export const formatSlugHook =
  (fallback: string): FieldHook =>
  ({ data, operation, originalDoc, value }) => {
    if (typeof value === 'string') {
      return formatSlug(value)
    }

    if (operation === 'create' || !data?.slug) {
      const fallbackData = data?.[fallback] || data?.[fallback]

      if (fallbackData && typeof fallbackData === 'string') {
        return formatSlug(fallbackData)
      }
    }

    return value
  }
