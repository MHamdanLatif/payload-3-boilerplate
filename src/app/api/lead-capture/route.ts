import { handleLeadCapture } from '@/lib/lead-capture'

/**
 * Public lead-capture endpoint. Every site form posts here.
 *
 * This is the canonical path. It exists because the previous one, /api/leads,
 * collided with Payload's REST endpoint for the leads collection and broke
 * lead creation in the admin panel — see src/lib/lead-capture.ts for the full
 * account. The old path still works while cached browser bundles drain.
 */
export async function POST(req: Request) {
  return handleLeadCapture(req)
}
