import { parsePhoneNumberFromString } from 'libphonenumber-js'

export const MANUAL_SOURCES = ['whatsapp', 'call', 'referral'] as const
export function contactInput(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const raw = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (!name || name.length > 120) throw new Error('Enter a name (up to 120 characters).')
  const phone = parsePhoneNumberFromString(raw, 'PK')
  if (!phone?.isValid())
    throw new Error(
      'Enter a valid phone number, including country code for numbers outside Pakistan.',
    )
  return { name, phone: phone.number }
}

export function projectId(value: unknown): number | null {
  if (value === '' || value == null) return null
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Choose a valid project.')
  return id
}

export function manualAttribution(
  source: unknown,
  project: { id: number; title: string; slug?: string | null },
) {
  if (!MANUAL_SOURCES.includes(source as (typeof MANUAL_SOURCES)[number]))
    throw new Error('Choose WhatsApp, Call or Referral.')
  return {
    sourceKind: 'project',
    sourceName: project.title,
    sourceSlug: project.slug,
    source: String(source),
    acquisitionSource:
      source === 'call' ? ('manual' as const) : (source as 'whatsapp' | 'referral'),
    conversionSurface: 'crm-manual' as const,
    placement: 'crm-manual',
    acquiredProject: project.id,
    currentInterestedProject: project.id,
    firstTouchSource: String(source),
    firstTouchMedium: 'manual',
    firstTouchAt: new Date().toISOString(),
  }
}
