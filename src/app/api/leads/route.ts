import { handleLeadCapture } from '@/lib/lead-capture'

/**
 * DEPRECATED — superseded by /api/lead-capture.
 *
 * DELETE THIS FILE once cached bundles pointing at /api/leads have drained
 * (a day or two after the deploy that repointed the forms). Until then it must
 * keep working: browsers hold the old JavaScript, and removing it early would
 * hand those submissions to Payload's authenticated REST endpoint, which 401s
 * anonymous callers — losing real leads with no error surfaced to the visitor.
 *
 * Deleting it is also the POINT of the migration. While this file exists it
 * shadows Payload's /api/leads endpoint (a specific route beats the [...slug]
 * catch-all), so creating a lead in the admin fails with 400 "Invalid JSON" —
 * the admin sends multipart/form-data and this path expects JSON.
 *
 * Verify the old path is quiet before removing: no POSTs to /api/leads in the
 * Railway deploy logs.
 */
export async function POST(req: Request) {
  return handleLeadCapture(req)
}
