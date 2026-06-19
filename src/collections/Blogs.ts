import type { CollectionConfig } from 'payload'
import {
  BlockquoteFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { slugField } from '@/fields/slug'
import { autoFillBlogDefaults } from './Blogs/hooks/autoFillBlogDefaults'
import { injectInternalLinks } from './Blogs/hooks/injectInternalLinks'
import { populateSeoInternalLinks } from './Blogs/hooks/populateSeoInternalLinks'

export const Blogs: CollectionConfig = {
  slug: 'blogs',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'status', 'publishedAt', 'readTime'],
    description:
      'Karachi real-estate articles. Write the article in your Claude Max chat, generate the cover image in Gemini Pro, paste both in below. The CMS auto-derives excerpt/meta/read-time, auto-scans for project + location mentions to populate internal links, and wraps them as Lexical link nodes on publish.',
  },
  hooks: {
    // Order matters: auto-fill defaults first (so the scanner sees the freshly-
    // populated content), then scan for entities + merge into seoInternalLinks,
    // then wrap the anchor texts as link nodes when status = published.
    beforeChange: [autoFillBlogDefaults, populateSeoInternalLinks, injectInternalLinks],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    ...slugField('title'),
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Drafts are not visible publicly. Scheduled posts publish automatically when publishedAt is in the past.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Public visibility timestamp. Auto-filled by the generator.',
      },
    },
    {
      name: 'readTime',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Estimated read minutes. Computed from content length.',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      maxLength: 280,
      admin: { description: 'Index-card teaser. Max 280 chars.' },
    },
    // SEO meta (title / description / image) is owned by @payloadcms/plugin-seo
    // — see src/plugins/index.ts. It auto-injects a `meta` group on this
    // collection, with a richer preview + character counter UX than custom
    // fields could provide. Manual metaTitle / metaDescription fields used to
    // live here, but they wrote to the same Postgres columns (meta_title,
    // meta_description) as the plugin's group, producing an INSERT statement
    // with each column listed twice → SQL crash on every blog save. Removed.
    {
      name: 'keywords',
      type: 'array',
      labels: { singular: 'Keyword', plural: 'Keywords' },
      admin: {
        description:
          'Semantic SEO keywords for this post. Emitted in <meta keywords> and used in derived OG tags.',
      },
      fields: [{ name: 'keyword', type: 'text', required: true }],
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Hero image for /blog index card and the post page.' },
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Article Body',
      admin: {
        description:
          'Paste markdown from your Claude conversation — `## headings`, `-` bullets, `**bold**`, `[text](url)` are auto-converted on paste. Aim for 1000–1500 words with H2 every 200–300 words.',
      },
      editor: lexicalEditor({
        features: () => [
          ParagraphFeature(),
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
          UnorderedListFeature(),
          OrderedListFeature(),
          BlockquoteFeature(),
          BoldFeature(),
          ItalicFeature(),
          UnderlineFeature(),
          StrikethroughFeature(),
          InlineCodeFeature(),
          SubscriptFeature(),
          SuperscriptFeature(),
          LinkFeature(),
          HorizontalRuleFeature(),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
    },
    {
      name: 'seoInternalLinks',
      type: 'array',
      label: 'SEO Internal Links',
      admin: {
        description:
          'Auto-populated from project/location names detected in the article body. Review before publishing. On every save where status=published, the publish hook wraps the first exact match of each anchorText inside the article content with a link to the resolved target URL. Already-injected entries are skipped on subsequent saves.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'anchorText',
          type: 'text',
          required: true,
          admin: { description: 'The exact phrase in the article body to wrap as a link.' },
        },
        {
          name: 'linkType',
          type: 'select',
          required: true,
          defaultValue: 'project',
          options: [
            { label: 'Project', value: 'project' },
            { label: 'Location', value: 'location' },
            { label: 'Home / Index', value: 'index' },
          ],
        },
        {
          name: 'targetProject',
          type: 'relationship',
          relationTo: 'featured-projects',
          admin: {
            condition: (_data, siblingData) => siblingData?.linkType === 'project',
          },
        },
        {
          name: 'targetLocationSlug',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => siblingData?.linkType === 'location',
            description: 'Slug only, e.g. "scheme-33". Resolves to /locations/<slug>.',
          },
        },
        {
          name: 'injected',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Set by the publish hook once the link has been injected into the content.',
            readOnly: true,
          },
        },
      ],
    },
    {
      // `generatedBy` group from the old automation pipeline is hidden — the
      // DB columns (generated_by_topic_id, generated_by_model, generated_by_generated_at,
      // generated_by_placement_warnings) stay so historical rows aren't damaged.
      // Use BlogTopics → `publishedAs` to link a content-backlog item to a Blog now.
      name: 'generatedBy',
      type: 'group',
      admin: { hidden: true },
      fields: [
        { name: 'topic', type: 'relationship', relationTo: 'blog-topics' },
        { name: 'model', type: 'text' },
        { name: 'generatedAt', type: 'date' },
        { name: 'placementWarnings', type: 'textarea' },
      ],
    },
  ],
}
