import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { leadAfterChange } from './Leads/hooks/leadAfterChange'
import { seedLeadDefaults } from './Leads/hooks/seedLeadDefaults'

/**
 * Every website / Meta lead lives here — the native CRM that replaces Privyr.
 *
 * On create, hooks fire the owner's WhatsApp alert and auto-send the lead their
 * trackable brochure link. When an agent sets status to qualified/junk, a Meta
 * Conversions API event is sent so ad optimisation learns from real outcomes.
 * All outbound calls are best-effort (logged, never block the save).
 *
 * Read/update/delete are admin-only; creates come from the server route via the
 * Local API (which overrides access).
 */
export const Leads: CollectionConfig = {
  slug: 'leads',
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    group: 'CRM',
    defaultColumns: ['name', 'phone', 'sourceName', 'status', 'brochureOpenedAt', 'source', 'createdAt'],
    description:
      'Every website & Meta lead. Set “Status” after calling — qualified/junk feeds Meta CAPI. The trackable brochure link and WhatsApp alerts fire automatically on new leads.',
  },
  hooks: {
    // beforeChange: fill brochureId + brochure assets from the linked project.
    beforeChange: [seedLeadDefaults],
    // afterChange: WhatsApp owner alert + brochure auto-send (create); Meta CAPI
    // on qualify/junk. Never throws.
    afterChange: [leadAfterChange],
  },
  fields: [
    // ── Qualification (sidebar, prominent) ──────────────────────────────────
    {
      name: 'status',
      type: 'select',
      // Not `required` at the type level so server creates needn't pass it — the
      // defaultValue + NOT NULL DEFAULT column guarantee it's always set.
      defaultValue: 'unqualified',
      options: [
        { label: 'Unqualified', value: 'unqualified' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Junk', value: 'junk' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Set after calling. “Qualified” or “Junk” sends a Meta CAPI event.',
      },
    },
    {
      name: 'brochureId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Auto-generated. The trackable link is /brochure/<this id>.',
      },
    },
    // "Send File" — Privyr-style manual brochure send via WhatsApp (wa.me). No
    // Meta charges; the owner reviews and taps send. Renders in the sidebar.
    {
      name: 'sendFile',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/SendFileButton#SendFileButton',
        },
      },
    },

    // ── Core lead ───────────────────────────────────────────────────────────
    { name: 'name', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'email', type: 'text' },
    {
      name: 'sourceKind',
      type: 'text',
      admin: {
        description:
          'project | listing | location | payment-plan | consultation | zero-results | meta-ad | unknown',
      },
    },
    { name: 'sourceName', type: 'text', label: 'Enquiring about (name)' },
    { name: 'sourceSlug', type: 'text', label: 'Enquiring about (slug)' },
    { name: 'placement', type: 'text' },
    { name: 'source', type: 'text', label: 'Source tag' },
    { name: 'notes', type: 'textarea' },
    { name: 'propertyType', type: 'text' },
    { name: 'budget', type: 'text' },
    {
      name: 'searchedParams',
      type: 'json',
      admin: { description: 'Filters from the /properties no-results form, when applicable.' },
    },

    // ── Meta attribution — captured at submission, reused for CAPI matching ──
    {
      type: 'collapsible',
      label: 'Meta attribution',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'eventId',
          type: 'text',
          admin: { readOnly: true, description: 'Dedup key shared with the browser Pixel Lead event.' },
        },
        { name: 'fbclid', type: 'text', admin: { readOnly: true } },
        { name: 'fbc', type: 'text', admin: { readOnly: true, description: '_fbc cookie value.' } },
        { name: 'fbp', type: 'text', admin: { readOnly: true, description: '_fbp cookie value.' } },
        { name: 'clientIp', type: 'text', admin: { readOnly: true } },
        { name: 'userAgent', type: 'text', admin: { readOnly: true } },
        {
          name: 'metaAdName',
          type: 'text',
          admin: { description: 'Ad / campaign name, for leads synced from a Meta Instant Form.' },
        },
      ],
    },

    // ── Brochure (trackable multi-asset link) ───────────────────────────────
    {
      type: 'collapsible',
      label: 'Brochure link assets',
      admin: {
        initCollapsed: true,
        description:
          'What /brochure/<id> shows this lead. Pre-filled from the linked project on create; override per lead here.',
      },
      fields: [
        { name: 'brochureHeadline', type: 'text', label: 'Headline (e.g. project name)' },
        { name: 'brochurePdfPrimary', type: 'upload', relationTo: 'media', label: 'Brochure PDF 1' },
        { name: 'brochurePdfSecondary', type: 'upload', relationTo: 'media', label: 'Brochure PDF 2' },
        {
          name: 'brochureMapEmbed',
          type: 'text',
          label: 'Google Maps embed URL',
          admin: { description: 'The `src` from a Google Maps “Embed a map” iframe.' },
        },
        {
          name: 'brochureVideoUrl',
          type: 'text',
          label: 'Video URL (YouTube / Vimeo)',
        },
      ],
    },

    // ── Delivery log (read-only diagnostics) ────────────────────────────────
    {
      type: 'collapsible',
      label: 'Delivery log',
      admin: { initCollapsed: true, description: 'Outbound automation status — ntfy alerts, brochure send & Meta CAPI.' },
      fields: [
        { name: 'ownerNotifiedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'ownerNotifyStatus', type: 'text', admin: { readOnly: true } },
        { name: 'brochureSentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'brochureSendStatus', type: 'text', admin: { readOnly: true } },
        {
          name: 'brochureOpenedAt',
          type: 'date',
          label: 'Brochure first opened',
          admin: {
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Read receipt — when the lead first opened their brochure link.',
          },
        },
        { name: 'capiEventName', type: 'text', admin: { readOnly: true } },
        { name: 'capiSentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'capiStatus', type: 'text', admin: { readOnly: true } },
      ],
    },

    // ── Legacy Privyr fields (kept; Privyr forward still runs as a fallback) ─
    {
      name: 'privyrForwarded',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Did Privyr accept this lead? (Legacy — being replaced by native CRM.)' },
    },
    {
      name: 'privyrStatus',
      type: 'text',
      admin: { readOnly: true, description: 'Privyr response status or error, for diagnostics.' },
    },
  ],
}
