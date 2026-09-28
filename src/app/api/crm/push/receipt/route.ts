import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { verifyLeadAction } from '@/lib/lead-action-link'

export async function POST(req: Request) {
  const query = new URL(req.url).searchParams
  const id = query.get('id') || ''
  const device = query.get('device') || ''
  if (
    !/^\d+$/.test(id) ||
    !/^[a-f0-9]{64}$/.test(device) ||
    !verifyLeadAction(id, 'push-receipt:' + device, query.get('sig'))
  )
    return new Response(null, { status: 403 })
  const payload = await getPayload({ config })
  await payload.db.drizzle.execute(sql`
    UPDATE lead_notifications SET receipts = COALESCE(receipts, '[]'::jsonb) || ${JSON.stringify([device])}::jsonb,
      updated_at = NOW()
    WHERE id = ${Number(id)} AND NOT COALESCE(receipts, '[]'::jsonb) @> ${JSON.stringify([device])}::jsonb
  `)
  return new Response(null, { status: 204 })
}
