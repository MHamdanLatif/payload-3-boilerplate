import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { slugField } from '@/fields/slug'
import { LOCATION_OPTIONS } from './FeaturedProjects'

export const PROPERTY_TYPE_OPTIONS = ['Flat', 'Plot', 'Office', 'Shop', 'Commercial'] as const

export const PropertyListings: CollectionConfig = {
  slug: 'property-listings',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'propertyType', 'location', 'status', 'price'],
    description:
      'Individual ready-to-move units — a specific flat, plot, office, shop, or commercial space (ready, resale, or urgent sale).',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Listing Title',
      admin: {
        description:
          'Write SEO-friendly titles like "2-Bed Apartment in Gulshan-e-Iqbal Block 16" — what a buyer would type into Google.',
      },
    },
    ...slugField('title'),
    {
      name: 'propertyType',
      type: 'select',
      required: true,
      label: 'Property Type',
      options: PROPERTY_TYPE_OPTIONS.map((v) => ({ label: v, value: v })),
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      label: 'Exact Price (PKR)',
    },
    {
      name: 'location',
      type: 'select',
      required: true,
      options: LOCATION_OPTIONS.map((v) => ({ label: v, value: v })),
    },
    {
      name: 'rooms',
      type: 'number',
      label: 'Rooms',
      admin: {
        description:
          'Total number of rooms (bedrooms + drawing/dining counted as rooms in Karachi convention).',
      },
    },
    {
      name: 'bathrooms',
      type: 'number',
    },
    {
      name: 'areaSqFt',
      type: 'number',
      label: 'Area (sq. ft.)',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Ready for Possession', value: 'Ready for Possession' },
        { label: 'Resale', value: 'Resale' },
        { label: 'Urgent Sale', value: 'Urgent Sale' },
      ],
    },
    {
      name: 'parentProject',
      type: 'relationship',
      relationTo: 'featured-projects',
      label: 'Parent Project',
      admin: {
        description:
          'Optional link to a featured development. If set, the card uses the project name; if blank, falls back to "Society Name" below.',
      },
    },
    {
      name: 'societyName',
      type: 'text',
      label: 'Society Name (fallback)',
      admin: {
        description:
          'Used when the listing is not part of a featured project (e.g. Bahria Town, Defence Phase 6). Ignored if Parent Project is set.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Short Summary (SEO)',
      maxLength: 220,
      admin: {
        description:
          'One-sentence pitch under 160 chars. Used as the SEO meta description when no Meta Description is set in the SEO tab.',
      },
    },
    {
      name: 'mainImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Cover photo. Used on the home card AND as the landing-page hero background.',
      },
    },
    {
      name: 'additionalImages',
      type: 'array',
      label: 'Additional Photos (Gallery)',
      labels: { singular: 'Photo', plural: 'Photos' },
      admin: {
        description: 'Optional. Rendered as a gallery section on the landing page.',
      },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'walkthroughVideoUrl',
      type: 'text',
      label: 'Walk-Through Video URL (YouTube / Vimeo)',
      admin: {
        description:
          'Paste a YouTube or Vimeo video URL (the full watch URL — we extract the ID). Optional.',
      },
    },
    {
      name: 'amenities',
      type: 'array',
      label: 'Amenities',
      labels: { singular: 'Amenity', plural: 'Amenities' },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      name: 'googleMapsEmbedUrl',
      type: 'text',
      label: 'Google Maps Embed URL',
      admin: {
        description:
          'Paste only the `src` URL from a Google Maps "Embed a map" iframe. We also auto-extract lat/lng from this URL for SEO structured data — no manual coordinates needed.',
      },
    },
    {
      name: 'addressLine',
      type: 'text',
      label: 'Street Address (SEO)',
      admin: {
        description:
          'Optional street-level address used for Schema.org structured data. e.g. "Block 16, Gulshan-e-Iqbal, near Hassan Square". Not displayed on the page.',
      },
    },
    {
      name: 'faqs',
      type: 'array',
      label: 'Frequently Asked Questions',
      labels: { singular: 'FAQ', plural: 'FAQs' },
      admin: {
        description:
          'Optional. Rendered as a collapsible FAQ section on the landing page AND emitted as Schema.org FAQPage JSON-LD to enable Google’s drop-down rich results.',
      },
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'textarea', required: true },
      ],
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Long Description',
      admin: { description: 'Renders in the Overview section of the landing page.' },
    },
  ],
}
