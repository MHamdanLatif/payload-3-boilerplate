/**
 * The WhatsApp brochure message, built in one place.
 *
 * Two callers need it and must never drift: the "Send File" button in the admin
 * (client-side) and the send-brochure endpoint behind the push notification's
 * action button (server-side). Before this existed the wording lived only inside
 * the button, so anything else sending a brochure would have quietly invented
 * its own.
 *
 * Deliberately dependency-free so both runtimes can import it.
 */

/** Mirrors the default on the CRM Settings global. */
export const DEFAULT_BROCHURE_TEMPLATE = "Hi {name}, here's the {project} brochure: {link}"

/** Fill the editable template. Unknown placeholders are left untouched. */
export function buildBrochureMessage({
  template,
  name,
  project,
  link,
}: {
  template?: string | null
  name?: string | null
  project?: string | null
  link: string
}): string {
  const firstName = String(name ?? '').trim().split(/\s+/)[0] || 'there'
  return (template || DEFAULT_BROCHURE_TEMPLATE)
    .replaceAll('{name}', firstName)
    .replaceAll('{project}', String(project || 'your'))
    .replaceAll('{link}', link)
}

/**
 * A wa.me deep link that opens the lead's chat with the message pre-typed.
 *
 * Nothing is sent by this: the owner still reviews and taps send inside
 * WhatsApp, which is what keeps this free of Meta's per-message charges.
 */
export function whatsappSendUrl(phone: string, message: string): string {
  return `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}

/** The lead's own trackable brochure page. */
export function brochureLink(baseUrl: string, brochureId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/brochure/${brochureId}`
}
