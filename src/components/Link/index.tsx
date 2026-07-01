import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from 'src/utilities/cn'
import Link from 'next/link'
import React from 'react'

type CMSLinkType = {
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  label?: string | null
  newTab?: boolean | null
  reference?: {
    relationTo: string
    value: { slug?: string | null } | string | number
  } | null
  size?: ButtonProps['size'] | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

// The public route for a collection often differs from its Payload collection
// slug. Internal (reference) links must resolve to the real route, not
// `/<collectionSlug>/<slug>`. Add a mapping here whenever a routable collection
// lives under a different path. `pages` sit at the root; anything not listed
// falls back to `/<relationTo>/<slug>`.
const COLLECTION_ROUTE_PREFIX: Record<string, string> = {
  pages: '',
  posts: '/posts',
  blogs: '/blog',
  'featured-projects': '/projects',
  'property-listings': '/listings',
}

function referenceHref(relationTo: string, slug: string): string {
  const prefix = COLLECTION_ROUTE_PREFIX[relationTo] ?? `/${relationTo}`
  return `${prefix}/${slug}`
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href =
    type === 'reference' && typeof reference?.value === 'object' && reference.value.slug
      ? referenceHref(reference.relationTo, reference.value.slug)
      : url

  if (!href) return null

  const size = appearance === 'link' ? 'clear' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
