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
  project: { id: number; title: string; slug?: string | null; linkedProject?: number | { id: number } | null },
  kind: 'project' | 'marketed-project' = 'project',
) {
  if (!MANUAL_SOURCES.includes(source as (typeof MANUAL_SOURCES)[number]))
    throw new Error('Choose WhatsApp, Call or Referral.')
  const featuredId = kind === 'project'
    ? project.id
    : typeof project.linkedProject === 'object' ? project.linkedProject?.id : project.linkedProject
  return {
    sourceKind: kind,
    sourceName: project.title,
    sourceSlug: project.slug,
    source: String(source),
    acquisitionSource:
      source === 'call' ? ('manual' as const) : (source as 'whatsapp' | 'referral'),
    conversionSurface: 'crm-manual' as const,
    placement: 'crm-manual',
    acquiredProject: featuredId,
    currentInterestedProject: featuredId,
    ...(kind === 'marketed-project' ? { marketedProject: project.id } : {}),
    firstTouchSource: String(source),
    firstTouchMedium: 'manual',
    firstTouchAt: new Date().toISOString(),
  }
}
