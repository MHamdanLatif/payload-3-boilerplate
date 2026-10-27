import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> }

/**
 * The drizzle handle for the request's open Payload transaction, so validation reads,
 * locks and the write they guard commit or roll back together.
 */
export async function txDb(req: PayloadRequest): Promise<Executor> {
  const id = req.transactionID instanceof Promise ? await req.transactionID : req.transactionID
  const db = req.payload.db as unknown as {
    sessions?: Record<string, { db: Executor }>
    drizzle: Executor
  }
  return (id && db.sessions?.[String(id)]?.db) || db.drizzle
}

export async function ledgerSum(req: PayloadRequest, query: ReturnType<typeof sql>) {
  return (await (await txDb(req)).execute(query)).rows as Record<string, any>[]
}

/** Serialise writes that validate against a running balance (a deal or a project pool). */
export async function lockFinance(req: PayloadRequest, key: string) {
  await (await txDb(req)).execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`)
}

const SKIP = new Set(['updatedAt', 'createdAt', 'updatedBy', 'createdBy', 'entryKey', 'id'])
const plain = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(plain)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    // A populated relationship is recorded by its id.
    if ('id' in o && ('createdAt' in o || 'updatedAt' in o)) return o.id
    return Object.fromEntries(
      Object.entries(o)
        .filter(([k]) => k !== 'id')
        .map(([k, x]) => [k, plain(x)]),
    )
  }
  return v ?? null
}

/**
 * Basic change history: who changed which financial fields, from what to what, and why.
 * Written with the same request so it commits atomically with the change itself.
 */
export const financeAudit: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  collection,
}) => {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  if (operation === 'update')
    for (const key of new Set([...Object.keys(previousDoc || {}), ...Object.keys(doc || {})])) {
      if (SKIP.has(key)) continue
      const from = plain(previousDoc?.[key]),
        to = plain(doc?.[key])
      if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to }
    }
  if (operation === 'update' && !Object.keys(changes).length) return doc
  await req.payload.create({
    collection: 'finance-audit-log',
    data: {
      targetCollection: collection.slug,
      targetId: String(doc.id),
      operation: changes.voided ? 'void' : operation,
      changes,
      reason:
        (changes.voided && doc.voidReason) ||
        (doc.changeReason !== previousDoc?.changeReason && doc.changeReason) ||
        null,
      user: req.user?.collection === 'users' ? req.user.id : null,
    },
    req,
    overrideAccess: true,
  })
  return doc
}
