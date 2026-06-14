import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { slugField } from '@/fields/slug'
import { seedPaymentHeads } from './FeaturedProjects/hooks/seedPaymentHeads'

export const LOCATION_OPTIONS = [
  'Gulshan-e-Iqbal',
  'Gulistan-e-Jauhar',
  'Scheme 33',
  'DHA',
  'Clifton',
  'M.A. Jinnah Road',
  'Jinnah Avenue',
  'Malir',
  'Saddar',
  'Korangi',
  'Model Colony',
  'Sukkur',
  'Other',
] as const

export const UNIT_TYPE_OPTIONS = [
  '1 Bed Lounge',
  '2 Bed Lounge',
  '2 Bed Drawing',
  '2 Bed DD / 3 Bed Lounge',
  '3 Bed Lounge',
  '3 Bed Drawing',
  '4 Bed Drawing',
  '4+ Rooms',
] as const

export const FeaturedProjects: CollectionConfig = {
  slug: 'featured-projects',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'builderName', 'location', 'status', 'startingPrice'],
    description:
      'Ongoing developments — pre-launch or under-construction projects. Each published project auto-generates a /projects/<slug> landing page and surfaces on the home Featured section.',
  },
  hooks: {
    beforeChange: [seedPaymentHeads],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Project Title',
    },
    ...slugField('title'),
    {
      name: 'builderName',
      type: 'text',
      required: true,
      label: 'Builder / Developer',
      admin: { description: 'e.g. Saima Group.' },
    },
    {
      name: 'propertyType',
      type: 'select',
      required: true,
      label: 'Property Type',
      options: [
        { label: 'Flat', value: 'Flat' },
        { label: 'Plot', value: 'Plot' },
        { label: 'Office', value: 'Office' },
        { label: 'Shop', value: 'Shop' },
        { label: 'Commercial', value: 'Commercial' },
      ],
      admin: {
        description: 'Used by the /properties filter to match against listings.',
      },
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
      admin: { description: 'Richer category for project landing pages.' },
    },
    {
      name: 'startingPrice',
      type: 'number',
      label: 'Starting Price (PKR)',
      admin: {
        description:
          'Lowest entry price for the project, in PKR. Used by the budget-range filter and the home Featured cards.',
      },
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
      label: 'Short Summary (SEO)',
      maxLength: 220,
      admin: {
        description:
          'One-sentence pitch (under 160 chars ideal). Used as the SEO meta description when no Meta Description is set in the SEO tab.',
      },
    },
    {
      name: 'elevationImages',
      type: 'array',
      label: 'Elevation Images',
      labels: { singular: 'Elevation', plural: 'Elevations' },
      minRows: 1,
      required: true,
      admin: {
        description:
          'Day-time elevation/render images. The first one is used as the hero background on the landing page and as the card image on the home Featured section.',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'nightElevation',
      type: 'upload',
      relationTo: 'media',
      label: 'Night Elevation (optional)',
      admin: {
        description: 'Night-time render. Drives the "Night Elevation" feature card on the landing page.',
      },
    },
    {
      name: 'brochure',
      type: 'upload',
      relationTo: 'media',
      label: 'Project Brochure (PDF)',
      admin: {
        description: 'PDF brochure for the "Download Brochure" CTA. Optional but strongly recommended.',
      },
    },
    {
      name: 'googleMapsEmbedUrl',
      type: 'text',
      label: 'Google Maps Embed URL',
      admin: {
        description:
          'Paste only the `src` URL from a Google Maps "Embed a map" iframe. Powers the Location section AND we auto-extract lat/lng from it for SEO structured data — no manual coordinates needed.',
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
      name: 'amenities',
      type: 'array',
      label: 'Amenities',
      labels: { singular: 'Amenity', plural: 'Amenities' },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'photoGallery',
      type: 'array',
      label: 'Photo Gallery',
      labels: { singular: 'Photo', plural: 'Photos' },
      admin: {
        description: 'Optional. If empty, the Gallery section is hidden on the landing page.',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'unitTypes',
      type: 'array',
      label: 'Unit Types (search-only, hidden from landing page)',
      labels: { singular: 'Unit Type', plural: 'Unit Types' },
      admin: {
        description:
          'NOT displayed on the landing page. Powers the /properties Unit Type filter. Add one row per available unit configuration.',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Unit Name (optional)',
          admin: {
            description:
              'Human-friendly label for this unit row — e.g. "Marquee Type A", "Junior Suite", "East-facing 3BR". Shown in the payment-plan unit selector and the PDF so buyers can refer to specific units.',
          },
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          options: UNIT_TYPE_OPTIONS.map((v) => ({ label: v, value: v })),
        },
        {
          name: 'rooms',
          type: 'number',
          required: true,
          label: 'Rooms',
          admin: { description: 'Total number of rooms (bedrooms + drawing/dining counted as rooms in Karachi convention).' },
        },
        {
          name: 'price',
          type: 'number',
          label: 'Price (PKR)',
          required: true,
        },
        {
          name: 'areaSqFt',
          type: 'number',
          label: 'Area (sq. ft.)',
        },
        {
          name: 'loanAmount',
          type: 'number',
          label: 'Fixed Loan Amount (PKR)',
          admin: {
            description:
              'Optional. Pre-arranged loan component applicable to this unit (immutable by client). When the buyer toggles "Include Expected Loan?" in the calculator, this amount is subtracted from the unit price before computing the plan.',
          },
        },
        {
          name: 'defaultPlan',
          type: 'group',
          label: 'Builder Default Payment Plan',
          admin: {
            description:
              'Optional. Pre-fill the buyer-facing calculator with the actual builder plan for this unit. When set, the calculator opens with these values and the buyer can adjust them. Leave blank to use generic defaults.',
          },
          fields: [
            {
              name: 'downPaymentPct',
              type: 'number',
              label: 'Down Payment (%)',
              min: 10,
              max: 100,
              admin: {
                description: 'e.g. 20 for a 20% down payment. Leave blank to use the project default.',
              },
            },
            {
              name: 'possessionPct',
              type: 'number',
              label: 'Possession (%)',
              min: 0,
              max: 5,
              admin: {
                description: 'e.g. 5 for 5% at handover. Leave blank to use the project default.',
              },
            },
            {
              name: 'installments',
              type: 'array',
              label: 'Default Installments',
              labels: { singular: 'Installment', plural: 'Installments' },
              admin: {
                description:
                  'One row per frequency the builder plan uses. e.g. Monthly @ PKR 38,375 + Half-Yearly @ PKR 501,000. The calculator pre-fills these as LOCKED on first load so the table matches the builder plan exactly; the buyer can unlock to recompute.',
              },
              fields: [
                {
                  name: 'frequency',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Monthly', value: 'Monthly' },
                    { label: 'Quarterly', value: 'Quarterly' },
                    { label: 'Half-Yearly', value: 'HalfYearly' },
                  ],
                },
                {
                  name: 'amount',
                  type: 'number',
                  required: true,
                  label: 'Amount per period (PKR)',
                },
                {
                  name: 'locked',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: {
                    description:
                      'When checked, the calculator opens with this value locked (fixed). Buyer can unlock to let the engine recompute.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Long Description',
      admin: {
        description: 'Renders in the Overview section of the landing page.',
      },
    },
    {
      name: 'paymentPlan',
      type: 'group',
      label: 'Payment Plan Configuration',
      admin: {
        description:
          'Guardrails for the buyer-facing payment plan calculator on this project. Uncheck `enabled` to hide the calculator section entirely.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'When unchecked, the calculator section does not render.' },
        },
        {
          name: 'priceOverride',
          type: 'number',
          label: 'Total Price Override (PKR)',
          admin: {
            description:
              'Override total price used by the calculator. Falls back to: (a) buyer-selected unit type price, (b) Starting Price, (c) smallest unit price.',
          },
        },
        {
          name: 'totalDurationMonths',
          type: 'number',
          required: true,
          defaultValue: 36,
          min: 6,
          max: 84,
          admin: {
            description:
              'Total construction period in months. Grey-structure phase = first half; finishing = second half; possession follows.',
          },
        },
        {
          name: 'downPaymentMinPct',
          type: 'number',
          required: true,
          defaultValue: 10,
          min: 0,
          max: 90,
          label: 'Down Payment Minimum (%)',
        },
        {
          name: 'downPaymentMaxPct',
          type: 'number',
          required: true,
          defaultValue: 30,
          min: 0,
          max: 95,
          label: 'Down Payment Maximum (%)',
        },
        {
          name: 'possessionPct',
          type: 'number',
          required: true,
          defaultValue: 5,
          min: 0,
          max: 5,
          label: 'Possession Payment (%)',
          admin: { description: 'Payment due at handover. Business rule: capped at 5%.' },
        },
        {
          name: 'paymentHeads',
          type: 'array',
          label: 'Payment Heads',
          admin: {
            description:
              'Master payment-head catalogue for this project. 19 defaults pre-seed on first save. Toggle heads on/off; click "Add Row" to add a Custom Head and assign it to one of the four backend classifications (Initial Payment, Grey Structure, Finishing, Possession). Time-Based heads correspond to the Monthly / Quarterly / Half-Yearly installment cadences.',
            initCollapsed: true,
          },
          fields: [
            { name: 'name', type: 'text', required: true },
            {
              name: 'category',
              type: 'select',
              required: true,
              options: [
                { label: 'Initial Payment', value: 'Initial Payment' },
                { label: 'Time-Based', value: 'Time-Based' },
                { label: 'Grey Structure', value: 'Grey Structure' },
                { label: 'Finishing', value: 'Finishing' },
                { label: 'Possession', value: 'Possession' },
              ],
            },
            { name: 'enabled', type: 'checkbox', defaultValue: true },
            {
              name: 'isCustom',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Auto-set. Defaults are isCustom=false; admin-added heads = true.' },
            },
          ],
        },
        // Legacy — kept for PaymentPlanLeads backwards compat; not used by the new compute engine.
        {
          name: 'greyStructureSharePct',
          type: 'number',
          defaultValue: 50,
          admin: { hidden: true, description: 'Legacy. Unused by the v2 engine.' },
        },
        {
          name: 'installmentFrequency',
          type: 'select',
          defaultValue: 'Monthly',
          options: [
            { label: 'Monthly', value: 'Monthly' },
            { label: 'Quarterly', value: 'Quarterly' },
          ],
          admin: { hidden: true, description: 'Legacy. Unused by the v2 engine.' },
        },
        {
          name: 'projectLogo',
          type: 'upload',
          relationTo: 'media',
          label: 'Project / Builder Logo for PDF',
          admin: {
            description:
              'Optional brand mark shown top-right on the generated PDF. If blank, the PDF prints the project name in serif type instead.',
          },
        },
        {
          name: 'planDisclaimer',
          type: 'textarea',
          label: 'Per-Project Disclaimer (PDF)',
          admin: {
            description:
              'Optional. Appended to the sitewide default disclaimer in the PDF footer.',
          },
        },
      ],
    },
  ],
}
