import type { FeaturedProject } from '@/payload-types'

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
  if (project.status) out.push(project.status)
  out.push('Karachi real estate')
  out.push('Pakistan property')
  out.push('builder project inventory')
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
