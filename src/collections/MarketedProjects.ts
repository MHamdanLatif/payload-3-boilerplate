import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { LOCATION_OPTIONS } from './FeaturedProjects'

/**
 * Collapse a URL segment to a comparison key: lowercase, letters and digits only.
 *
 * `TulipComforts`, `tulipcomforts` and `tulip-comforts` all reduce to
 * `tulipcomforts`, which is how one CMS-authored slug answers to every casing a
 * shortener, an ad platform or a typing visitor might produce.
 */
export function normaliseSlugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Landing pages for paid traffic — a separate surface from `featured-projects`,
 * not a variant of it.
 *
 * The organic project page is built to rank: nav, overview, amenities, FAQ and
 * further-reading blocks all give a cold visitor somewhere to go that is not the
 * form. It also carries the permanent public price list. A page bought with ad
 * spend wants the opposite of all of that.
 *
 * Every content field is a COPY, never a reference. That is the whole point: a
 * limited-time campaign price can be published here without touching the organic
 * page, its structured data, or what Google has indexed. The one relationship
 * back to `featured-projects` is `linkedProject`, which is read server-side for
 * CRM attribution only and never enters the render path.
 */
export const MarketedProjects: CollectionConfig = {
  slug: 'marketed-projects',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Marketing',
    defaultColumns: ['title', 'slug', 'active', 'location', 'status'],
    description:
      'Standalone landing pages for paid campaigns, served at lateefproperties.com/<Slug>. Noindex — they never appear in Google, and are reachable only through an ad or a link you send. Content here is independent of Featured Projects, so campaign pricing never changes the public project page.',
  },
  hooks: {
    beforeChange: [
      // Derive the lookup key from whatever casing the editor typed.
      ({ data }) => {
        if (data && typeof data.slug === 'string') {
          data.slugKey = normaliseSlugKey(data.slug)
        }
        return data
      },
    ],
    // Deliberately NO indexNow ping: these pages are noindex, so telling Bing to
    // recrawl them is a contradiction.
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Project Title',
      admin: { description: 'Shown as the page heading. May differ from the organic project title.' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Ad URL',
      admin: {
        description:
          'The URL, exactly as typed — capitals are preserved. "TulipComforts" serves lateefproperties.com/TulipComforts. Letters, numbers and hyphens only. Visitors arriving at any other casing (/tulipcomforts, /tulip-comforts) are redirected here automatically, so put THIS spelling in the ad.',
      },
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !value) return 'An ad URL is required.'
        if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/.test(value)) {
          return 'Use letters, numbers and hyphens only (2-64 characters, starting with a letter or number).'
        }
        return true
      },
    },
    {
      // Casing-insensitive lookup key. Payload's `like` operator maps to a
      // SUBSTRING ilike on Postgres, so it cannot express "equals, ignoring
      // case" — this derived column can, with an index behind it.
      name: 'slugKey',
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Live',
      admin: {
        position: 'sidebar',
        description:
          'Uncheck to take the page down immediately (visitors get a 404). This collection has no draft state, so every save is live on a page you may be paying for traffic to — this is the off switch.',
      },
    },
    {
      name: 'linkedProject',
      type: 'relationship',
      relationTo: 'featured-projects',
      label: 'CRM: matching project',
      admin: {
        position: 'sidebar',
        description:
          'Reporting only — never shown on the page and never read for content. Leads captured here are stamped with this project so they group correctly in the CRM alongside organic leads. Leave blank and those leads arrive with no project attached.',
      },
    },
    {
      name: 'builderName',
      type: 'text',
      required: true,
      label: 'Builder / Developer',
      admin: { description: 'e.g. Al Wahab Builders.' },
    },
    {
      name: 'projectType',
      type: 'select',
      label: 'Project Category',
      options: [
        { label: 'Mixed-use', value: 'Mixed-use' },
        { label: 'Residential Tower', value: 'Residential Tower' },
        { label: 'Plot Community', value: 'Plot Community' },
      ],
    },
    {
      name: 'startingPrice',
      type: 'number',
      label: 'Starting Price (PKR)',
    },
    {
      name: 'location',
      type: 'select',
      required: true,
      options: LOCATION_OPTIONS.map((v) => ({ label: v, value: v })),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Pre-launch', value: 'Pre-launch' },
        { label: 'Under Construction', value: 'Under Construction' },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Hero Sub-line',
      maxLength: 220,
      admin: {
        description:
          'One sentence under the project name in the hero. Also used as the link-preview description when the URL is shared on WhatsApp.',
      },
    },
    {
      name: 'offerNote',
      type: 'text',
      label: 'Campaign Offer Line (optional)',
      admin: {
        description:
          'The limited-time hook, e.g. "Pre-launch pricing held until 30 September". Rendered as a highlighted strip in the hero. This is the field this whole collection exists for — it can say something the public project page does not.',
      },
    },
    {
      name: 'elevationImages',
      type: 'array',
      label: 'Elevation Images',
      labels: { singular: 'Elevation', plural: 'Elevations' },
      minRows: 1,
      required: true,
      admin: { description: 'The first is the hero background and the WhatsApp link-preview image.' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'brochure',
      type: 'upload',
      relationTo: 'media',
      label: 'Project Brochure (PDF)',
      admin: {
        description:
          'Not linked anywhere on the page — it is attached to the personalised pack that gets sent to a lead after they register.',
      },
    },
    {
      name: 'walkthroughVideoUrl',
      type: 'text',
      label: 'Walkthrough Video URL',
      admin: {
        description:
          'Plain YouTube link (https://youtu.be/xxxx), not an <iframe>. Copied onto every new lead from this page so their project pack shows the video. Set the video to Unlisted, not Private.',
      },
    },
    {
      name: 'builderTrackRecord',
      type: 'array',
      label: 'Builder Track Record',
      labels: { singular: 'Previous Project', plural: 'Previous Projects' },
      admin: {
        description:
          'The developer’s earlier projects, oldest first, ending with THIS one (tick "Current project" on that row). Needs at least two rows to render at all.',
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'image', type: 'upload', relationTo: 'media' },
        { name: 'location', type: 'text' },
        { name: 'detail', type: 'text' },
        { name: 'completedYear', type: 'text', label: 'Completed (year)' },
        { name: 'statusLine', type: 'text', label: 'Status line' },
        { name: 'isCurrent', type: 'checkbox', label: 'Current project', defaultValue: false },
      ],
    },
    {
      name: 'photoGallery',
      type: 'array',
      label: 'Photo Gallery',
      labels: { singular: 'Photo', plural: 'Photos' },
      admin: { description: 'Optional. If empty, the Gallery section is hidden.' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'amenities',
      type: 'array',
      label: 'Amenities',
      labels: { singular: 'Amenity', plural: 'Amenities' },
      admin: { description: 'Shown after the gallery. If empty, the Amenities section is hidden.' },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      name: 'googleMapsEmbedUrl',
      type: 'text',
      label: 'Google Maps Embed URL',
      admin: { description: 'Paste only the `src` URL from a Google Maps "Embed a map" iframe.' },
    },
    {
      name: 'availableUnits',
      type: 'array',
      label: 'Available Units',
      labels: { singular: 'Unit', plural: 'Units' },
      admin: {
        description: 'Used in the hero availability line and the enquiry form. Drag rows to change their order.',
      },
      fields: [
        { name: 'name', type: 'text', label: 'Name' },
        {
          name: 'type',
          type: 'text',
          required: true,
          label: 'Type',
          admin: { description: 'e.g. 2 Bed DD / 3 Bed Lounge or 3 Bed Drawing (Duplex).' },
        },
        { name: 'areaSqFt', type: 'number', label: 'Area (sq ft)', min: 1 },
      ],
    },
  ],
}
