import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

/**
 * Append-only audit log: every time a buyer downloads a payment-plan PDF
 * via /api/payment-plan/pdf, one row lands here. Admins see what each
 * lead modelled (project, unit, down-payment %, frequency) without
 * leaving the CMS — Privyr stays the primary CRM, this is the internal trail.
 *
 * `create` is `anyone` because the public API route writes here; `read` /
 * `update` / `delete` are admin-only.
 */
export const PaymentPlanLeads: CollectionConfig = {
  slug: 'payment-plan-leads',
  access: {
    create: anyone,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'displayLabel',
    group: 'Leads',
    defaultColumns: ['displayLabel', 'project', 'totalPrice', 'downPaymentPct', 'createdAt'],
    description:
      'Audit trail of payment-plan PDFs downloaded by leads. One row per download. Use to prioritise follow-up — these are high-intent buyers who built a custom plan.',
  },
  fields: [
    {
      name: 'displayLabel',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-computed: "{name} · {price} · {downPct}% down".',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'featured-projects',
      admin: {
        description:
          'Which project the lead built a plan for. Nullable so the audit row survives if the project is later deleted.',
      },
    },
    {
      name: 'projectTitleSnapshot',
      type: 'text',
      admin: {
        description: 'Project title at download time. Preserved even if the project is renamed or deleted later.',
      },
    },
    {
      name: 'selectedUnitType',
      type: 'text',
      admin: { description: 'Unit the buyer modelled, e.g. "3 Bed Lounge". Optional.' },
    },
    {
      name: 'totalPrice',
      type: 'number',
      required: true,
      label: 'Total Price (PKR)',
    },
    {
      name: 'downPaymentPct',
      type: 'number',
      required: true,
      label: 'Down Payment (%)',
    },
    {
      name: 'downPaymentAmount',
      type: 'number',
      required: true,
      label: 'Down Payment (PKR)',
    },
    {
      name: 'possessionPct',
      type: 'number',
      required: true,
      label: 'Possession (%)',
    },
    {
      name: 'greyStructureSharePct',
      type: 'number',
      required: true,
      label: 'Grey-Structure Share (%)',
    },
    {
      name: 'installmentFrequency',
      type: 'select',
      required: true,
      options: [
        { label: 'Monthly', value: 'Monthly' },
        { label: 'Quarterly', value: 'Quarterly' },
      ],
    },
    {
      name: 'totalDurationMonths',
      type: 'number',
      required: true,
    },
    {
      name: 'loanIncluded',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'True if the buyer toggled "Include Expected Loan?" on this plan.' },
    },
    {
      name: 'loanAmount',
      type: 'number',
      admin: { description: 'PKR loan component subtracted from price before plan math. Only meaningful when loanIncluded=true.' },
    },
    {
      name: 'engineVersion',
      type: 'text',
      defaultValue: 'v2',
      admin: { readOnly: true, description: 'Compute engine version used at download time.' },
    },
    {
      name: 'planSummary',
      type: 'json',
      admin: {
        description:
          'Full PlanResult snapshot (rows + totals + active heads + frequencies) at download time. Use this to re-render the exact PDF the lead got.',
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: {
        description: 'Browser user agent at download time. For debugging.',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data) return data
        const name = data.name ?? ''
        const price = typeof data.totalPrice === 'number' ? data.totalPrice : 0
        const pct = typeof data.downPaymentPct === 'number' ? data.downPaymentPct : 0
        const priceShort =
          price >= 10_000_000
            ? `${(price / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`
            : price >= 100_000
              ? `${(price / 100_000).toFixed(2).replace(/\.?0+$/, '')} Lac`
              : price.toLocaleString()
        return {
          ...data,
          displayLabel: `${name} · PKR ${priceShort} · ${pct}% down`,
        }
      },
    ],
  },
}
