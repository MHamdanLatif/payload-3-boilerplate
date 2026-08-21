/**
 * Single source for Lateef Properties' public contact details.
 *
 * These were previously written out separately in src/Footer/Component.tsx and
 * src/lib/seo-jsonld.ts. A phone number that appears in several files is a
 * number that eventually disagrees with itself, and it appears in structured
 * data Google reads, so a stale copy is worse than cosmetic.
 */
export const PHONE_E164 = '+923363528333'
export const PHONE_DISPLAY = '+92 336 3528333'
export const EMAIL = 'info.lateefproperties@gmail.com'
export const WHATSAPP_URL = 'https://wa.me/923363528333'

/** wa.me link with a prefilled message. Falls back to the bare link if empty. */
export function whatsappUrl(message?: string | null): string {
  if (!message) return WHATSAPP_URL
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`
}
