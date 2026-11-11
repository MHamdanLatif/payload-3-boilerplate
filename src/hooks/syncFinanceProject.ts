import type { CollectionAfterChangeHook } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { ledgerSum } from '@/lib/finance-tx'

/** Keep accounting identities stable, even if marketing links or public visibility change. */
export const syncFinanceProject: CollectionAfterChangeHook = async ({ doc, collection, req }) => {
  const featured = collection.slug === 'featured-projects'
  const key = `${featured ? 'featured' : 'marketed'}:${doc.id}`
  // A page created for an existing featured project shares that project's accounting.
  // A previously standalone page retains its own ledger when subsequently linked.
  if (!featured && doc.linkedProject) {
    await ledgerSum(req, sql`UPDATE finance_projects SET title=${doc.title}, updated_at=now() WHERE source_key=${key}`)
  } else {
    await ledgerSum(req, sql`INSERT INTO finance_projects (title, source_key, featured_project_id, marketed_project_id)
      VALUES (${doc.title}, ${key}, ${featured ? doc.id : null}, ${featured ? null : doc.id})
      ON CONFLICT (source_key) DO UPDATE SET title=EXCLUDED.title, updated_at=now()`)
  }
  return doc
}
