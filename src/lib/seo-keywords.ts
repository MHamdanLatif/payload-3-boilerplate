import type { FeaturedProject, PropertyListing } from '@/payload-types'

/**
 * Derive a dense, conversion-led keywords array from a FeaturedProject doc.
 * Programmatic SEO sites typically inject 12–25 derived phrases per page;
 * we cap at 25, deduplicate, and keep terms factual (no heritage filler).
 */
export function deriveProjectKeywords(project: FeaturedProject): string[] {
  const out: string[] = []
  const t = project.title
  const loc = project.location
  const pt = project.propertyType
  const pjt = project.projectType
  const builder = project.builderName

  if (t) {
    out.push(t)
    out.push(`${t} price`)
    out.push(`${t} location`)
    out.push(`${t} payment plan`)
    out.push(`${t} floor plan`)
    out.push(`${t} Karachi`)
  }
  if (builder) out.push(builder)
  if (loc) {
    out.push(loc)
    if (pt) out.push(`${pt} in ${loc}`)
    out.push(`${loc} apartments`)
    out.push(`${loc} real estate`)
    out.push(`${loc} Karachi`)
  }
  if (pt) out.push(pt)
  if (pjt) out.push(pjt)
  if (project.unitTypes) {
    for (const u of project.unitTypes) {
      if (u?.type) {
        out.push(u.type)
        if (loc) out.push(`${u.type} ${loc}`)
      }
    }
  }
  out.push('pre-launch')
  out.push('Karachi real estate')
  out.push('Pakistan property')
  out.push('off-market inventory')
  out.push('Lateef Properties')

  return dedupeCap(out, 25)
}

/**
 * Derive keywords from an individual PropertyListing.
 */
export function deriveListingKeywords(listing: PropertyListing): string[] {
  const out: string[] = []
  const t = listing.title
  const loc = listing.location
  const pt = listing.propertyType
  const rooms = listing.rooms
  const society =
    typeof listing.parentProject === 'object' && listing.parentProject?.title
      ? listing.parentProject.title
      : listing.societyName ?? null

  if (t) out.push(t)
  if (loc) {
    out.push(loc)
    out.push(`${loc} Karachi`)
  }
  if (pt) {
    out.push(pt)
    if (loc) out.push(`${pt} for sale in ${loc}`)
  }
  if (rooms != null) {
    out.push(`${rooms} bed`)
    out.push(`${rooms} room`)
    if (loc) {
      out.push(`${rooms} bed apartment in ${loc}`)
      out.push(`${rooms} bedroom flat ${loc}`)
      out.push(`${rooms} room apartment in ${loc}`)
      out.push(`${rooms} room flat ${loc}`)
      if (pt) out.push(`${rooms} bed ${pt} ${loc}`)
      if (pt) out.push(`${rooms} room ${pt} ${loc}`)
    }
  }
  if (society) {
    out.push(society)
    if (rooms != null) {
      out.push(`${rooms} bed ${society}`)
      out.push(`${rooms} room ${society}`)
    }
  }
  if (listing.status) out.push(listing.status)
  out.push('Karachi real estate')
  out.push('Pakistan property')
  out.push('ready to move')
  out.push('curated property')
  out.push('Lateef Properties')

  return dedupeCap(out, 25)
}

function dedupeCap(arr: string[], cap: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of arr) {
    const v = (raw ?? '').toString().trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
    if (out.length >= cap) break
  }
  return out
}
