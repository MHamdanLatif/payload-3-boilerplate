import { parsePhoneNumberFromString } from 'libphonenumber-js'

/**
 * Normalised phone identity used to spot repeat enquiries. Pakistani numbers written as
 * 03XXXXXXXXX, 923XXXXXXXXX, 00923XXXXXXXXX or +923XXXXXXXXX all become +923XXXXXXXXX;
 * valid international numbers keep their own country code. Anything that is not a valid
 * number returns null and is never matched, so a typo cannot link two different people.
 * Names are deliberately not part of the key.
 */
export function phoneKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim().replace(/[\s\-().]/g, '')
  if (!s) return null
  if (s.startsWith('00')) s = '+' + s.slice(2)
  if (!s.startsWith('+')) {
    if (!/^\d+$/.test(s)) return null
    if (/^92\d{10}$/.test(s)) s = '+' + s
  } else if (!/^\+\d+$/.test(s)) return null
  const phone = parsePhoneNumberFromString(s, 'PK')
  return phone?.isValid() ? phone.number : null
}
