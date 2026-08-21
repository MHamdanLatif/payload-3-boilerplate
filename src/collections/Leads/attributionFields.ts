import type { Field } from 'payload'
import { ACQUISITION_SOURCES, CONVERSION_SURFACES } from '@/lib/attribution'

/**
 * Attribution fields for the Leads collection.
 *
 * Kept in their own file because there are twenty-odd of them and inlining
 * would bury the rest of the collection.
 *
 * Two ideas the old schema conflated, now separated:
 *
 *   acquisitionSource   HOW the buyer was acquired  (meta-ads, google-organic)
 *   conversionSurface   WHERE they converted        (project-hero-form)
 *
 * The legacy `source` column held things like "project-landing:hero", which is
 * a surface, not a source - so it could answer neither question. It is left
 * untouched and still written, because it is the only attribution history the
 * existing 66 leads have.
 *
 * FIRST TOUCH IS IMMUTABLE. Enforced in the collection's beforeChange hook, not
 * merely by convention: a mutable field eventually gets mutated, and the one
 * thing this model must guarantee is that the campaign which acquired a buyer
 * survives every later visit.
 *
 * All fields are optional. Historical leads have no attribution and none is
 * invented for them - an honest null beats a fabricated "direct" that later
 * gets counted as organic performance.
 */

const touchFields = (prefix: 'firstTouch' | 'latestTouch', label: string): Field[] => [
  { name: `${prefix}Source`, type: 'text', label: `${label} source`, admin: { readOnly: true } },
  { name: `${prefix}Medium`, type: 'text', label: `${label} medium`, admin: { readOnly: true } },
  { name: `${prefix}Campaign`, type: 'text', label: `${label} campaign`, admin: { readOnly: true } },
  { name: `${prefix}Content`, type: 'text', label: `${label} content / ad`, admin: { readOnly: true } },
  { name: `${prefix}Term`, type: 'text', label: `${label} term`, admin: { readOnly: true } },
  { name: `${prefix}LandingPath`, type: 'text', label: `${label} landing page`, admin: { readOnly: true } },
  { name: `${prefix}Referrer`, type: 'text', label: `${label} referrer`, admin: { readOnly: true } },
  { name: `${prefix}Fbclid`, type: 'text', label: `${label} fbclid`, admin: { readOnly: true } },
  { name: `${prefix}Gclid`, type: 'text', label: `${label} gclid`, admin: { readOnly: true } },
  {
    name: `${prefix}At`,
    type: 'date',
    label: `${label} at`,
    admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
  },
]

export const attributionFields: Field[] = [
  {
    name: 'acquisitionSource',
    type: 'select',
    label: 'Acquisition source',
    options: ACQUISITION_SOURCES.map((v) => ({
      label: v
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      value: v,
    })),
    admin: {
      position: 'sidebar',
      description:
        'HOW this buyer was acquired. Derived automatically from the first touch for web enquiries; set by hand for walk-ins, referrals and phone leads.',
    },
  },
  {
    name: 'conversionSurface',
    type: 'select',
    label: 'Conversion surface',
    options: CONVERSION_SURFACES.map((v) => ({
      label: v
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      value: v,
    })),
    admin: {
      position: 'sidebar',
      description:
        'WHERE they converted - which form or CTA. Distinct from acquisition source: a Meta ad (source) can convert on the project hero form (surface).',
    },
  },
  {
    type: 'collapsible',
    label: 'Attribution - first touch (immutable)',
    admin: {
      initCollapsed: true,
      description:
        'The visit that ACQUIRED this buyer. Never overwritten, no matter how many times they return through other channels. This is what ad spend is judged against.',
    },
    fields: touchFields('firstTouch', 'First touch'),
  },
  {
    type: 'collapsible',
    label: 'Attribution - latest touch',
    admin: {
      initCollapsed: true,
      description:
        'The most recent visit that carried a campaign signal. Updates freely; useful for seeing what re-engaged a dormant buyer.',
    },
    fields: touchFields('latestTouch', 'Latest touch'),
  },
]
