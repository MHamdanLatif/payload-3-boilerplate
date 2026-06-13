import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'

import { FeaturedProject, Page, Post, PropertyListing } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

type SeoDoc = Post | Page | FeaturedProject | PropertyListing

function isFeaturedProject(doc: SeoDoc | undefined): doc is FeaturedProject {
  return !!doc && (doc as FeaturedProject).builderName !== undefined
}

function isPropertyListing(doc: SeoDoc | undefined): doc is PropertyListing {
  return (
    !!doc &&
    (doc as PropertyListing).status !== undefined &&
    [
      'Ready for Possession',
      'Resale',
      'Urgent Sale',
    ].includes((doc as PropertyListing).status as string)
  )
}

const generateTitle: GenerateTitle<SeoDoc> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Lateef Properties` : 'Lateef Properties'
}

const generateURL: GenerateURL<SeoDoc> = ({ doc }) => {
  const url = getServerSideURL()
  if (!doc?.slug) return url
  if (isFeaturedProject(doc)) return `${url}/projects/${doc.slug}`
  if (isPropertyListing(doc)) return `${url}/listings/${doc.slug}`
  return `${url}/${doc.slug}`
}

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      // @ts-expect-error
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
  }),
  seoPlugin({
    collections: ['pages', 'posts', 'featured-projects', 'property-listings', 'blogs'],
    uploadsCollection: 'media',
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  searchPlugin({
    collections: ['posts'],
    beforeSync: beforeSyncWithSearch,
    skipSync: ({ req }) =>
      process.env.DISABLE_SEARCH_SYNC === 'true' || Boolean(req.context.disableSearchSync),
    searchOverrides: {
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
]
