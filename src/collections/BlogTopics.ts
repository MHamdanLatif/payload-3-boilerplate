import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

/**
 * Content Backlog — was originally the cron's topic queue; now repurposed as
 * a planning surface. Add titles + keywords + notes for upcoming blogs;
 * write the articles manually in the Blogs collection; link them back via
 * the "Published As" field below.
 *
 * Note: DB field names retained as `isGenerated` and `generatedBlog` to avoid
 * a column-rename migration. Only labels + descriptions changed.
 */
export const BlogTopics: CollectionConfig = {
  slug: 'blog-topics',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'suggestedTitle',
    group: 'Content',
    defaultColumns: ['suggestedTitle', 'isGenerated', 'priority'],
    description:
      'Content backlog for upcoming blog posts. Add working titles + target keywords + brief notes. When you write and publish the article in /admin → Blogs, check "Written" and link via "Published As" so the backlog stays in sync.',
  },
  fields: [
    {
      name: 'suggestedTitle',
      type: 'text',
      required: true,
      label: 'Working Title',
    },
    {
      name: 'coreFocus',
      type: 'textarea',
      required: true,
      label: 'Notes / Brief',
      admin: {
        description:
          'Whatever helps you remember the angle — pain point, audience, key data point, sources to cite.',
      },
    },
    {
      name: 'targetKeywords',
      type: 'array',
      label: 'Target Keywords',
      labels: { singular: 'Keyword', plural: 'Keywords' },
      admin: {
        description: 'Phrases the article should naturally weave in. 4–6 ideal.',
      },
      fields: [{ name: 'keyword', type: 'text', required: true }],
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 100,
      admin: {
        position: 'sidebar',
        description: 'Lower = sooner. Sort the backlog by priority to find the next idea to write.',
      },
    },
    {
      name: 'isGenerated',
      type: 'checkbox',
      defaultValue: false,
      label: 'Written',
      admin: {
        position: 'sidebar',
        description: 'Check this when you publish the corresponding Blog.',
      },
    },
    {
      name: 'generatedBlog',
      type: 'relationship',
      relationTo: 'blogs',
      label: 'Published As',
      admin: {
        position: 'sidebar',
        description: 'Link to the published Blog post (if one exists).',
      },
    },
    // Legacy fields from the cron pipeline — hidden but retained so the DB
    // columns (generation_attempts, last_error) stay populated for historical
    // rows. Safe to remove via a DB sync script later if desired.
    {
      name: 'generationAttempts',
      type: 'number',
      defaultValue: 0,
      admin: { hidden: true },
    },
    {
      name: 'lastError',
      type: 'textarea',
      admin: { hidden: true },
    },
  ],
}
