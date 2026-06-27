import { MapPin, BadgeCheck, Building2, Layers, BedDouble } from 'lucide-react'
import type { FeaturedProject, Media } from '@/payload-types'
import { SectionRule } from '@/components/landing/SectionRule'
import { formatPkr, smallestUnit, imageUrl } from '@/lib/featured-projects'
import RichText from '@/components/RichText'
import { BrochureDownloadButton } from './BrochureDownloadButton'

const FACT_ICON = {
  status: BadgeCheck,
  type: Building2,
  category: Layers,
  location: MapPin,
  smallest: BedDouble,
}

export function ProjectOverview({ project }: { project: FeaturedProject }) {
  const small = smallestUnit(project)
  const brochureUrl = imageUrl(project.brochure as Media | null | undefined)

  const facts: { icon: keyof typeof FACT_ICON; label: string; value: string }[] = [
    { icon: 'status', label: 'Status', value: project.status ?? '—' },
    { icon: 'type', label: 'Property Type', value: project.propertyType ?? '—' },
    project.projectType && {
      icon: 'category' as const,
      label: 'Category',
      value: project.projectType,
    },
    { icon: 'location', label: 'Location', value: project.location ?? '—' },
    project.startingPrice && {
      icon: 'smallest' as const,
      label: 'Starting From',
      value: formatPkr(project.startingPrice),
    },
    small && {
      icon: 'smallest' as const,
      label: 'Starting From',
      value: small.type,
    },
  ].filter(Boolean) as { icon: keyof typeof FACT_ICON; label: string; value: string }[]

  return (
    <section className="bg-ivory py-20 md:py-28">
      <div className="container grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              01 / OVERVIEW
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep text-balance md:text-5xl">
            About {project.title}
          </h2>
          <SectionRule className="mt-6" />

          {project.description ? (
            <div className="mt-8 max-w-none text-brand-deep/80">
              <RichText
                content={project.description as Record<string, unknown>}
                enableGutter={false}
              />
            </div>
          ) : (
            <p className="mt-8 text-base leading-relaxed text-brand-deep/70 md:text-lg">
              {project.summary || `${project.title} in ${project.location}.`}
            </p>
          )}
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-28 rounded-2xl border border-brand-deep/10 bg-white p-6 shadow-luxe-sm md:p-8">
            <p className="eyebrow text-gold">Key Facts</p>
            <h3 className="mt-3 font-serif text-xl tracking-tight text-brand-deep">
              At a glance
            </h3>

            <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border">
              {facts.map(({ icon, label, value }) => {
                const Icon = FACT_ICON[icon]
                return (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 bg-white px-4 py-3.5"
                  >
                    <dt className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.2em] text-brand-deep/55">
                      <Icon className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.6} />
                      {label}
                    </dt>
                    <dd className="text-right font-medium text-brand-deep">{value}</dd>
                  </div>
                )
              })}
            </dl>

            {brochureUrl && (
              <BrochureDownloadButton
                brochureUrl={brochureUrl}
                projectTitle={project.title}
                projectSlug={project.slug ?? ''}
              />
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
