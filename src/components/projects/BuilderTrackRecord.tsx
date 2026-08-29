import Link from 'next/link'
import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import type { Blog, FeaturedProject } from '@/payload-types'
import { SectionRule } from '@/components/landing/SectionRule'

/**
 * The developer's track record, rendered as a progression ending in this project.
 *
 * A pre-launch buyer is being asked to pay for something that does not exist
 * yet, so the question underneath every other question is whether this builder
 * finishes what it starts. The page previously answered that with a single
 * field - the builder's name - and left the buyer to go and find out.
 *
 * The persuasive part is locality, not longevity. "Delivering since 1968" is a
 * claim; "these two towers are ten minutes from this site, go and look at them"
 * is verifiable. That is why the entries carry a location and one concrete
 * number rather than prose, and why the admin copy tells editors to keep the
 * list local rather than exhaustive.
 *
 * Server component - no client JS. Renders nothing when no entries exist, so
 * projects without a track record are unaffected.
 */
export function BuilderTrackRecord({
  project,
  sectionNumber = '03 / THE BUILDER',
}: {
  project: FeaturedProject
  sectionNumber?: string
}) {
  const entries = project.builderTrackRecord ?? []
  if (entries.length < 2) return null // a single entry is not a progression

  const story =
    project.builderStory && typeof project.builderStory === 'object'
      ? (project.builderStory as Blog)
      : null

  const builder = project.builderName || 'the developer'
  // "Al Wahab Builders's" reads wrong; a name already ending in s takes a bare
  // apostrophe. Rendered as a whole string so JSX cannot drop the character.
  const builderPossessive = /s$/i.test(builder) ? `${builder}’` : `${builder}’s`
  const previous = entries.filter((e) => !e.isCurrent)

  return (
    <section className="bg-cream/40 py-20 md:py-28">
      <div className="container">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">{sectionNumber}</span>
          <span className="h-px w-10 bg-gold" />
        </div>
        <h2 className="mt-6 max-w-2xl font-serif text-3xl leading-tight tracking-tight text-brand-deep md:text-4xl">
          Built by {builder}
        </h2>
        <SectionRule className="mt-6" />

        {/* The crawlable sentence. A buyer researching "is Al Wahab reliable"
            should find this answered in text, not inferred from a card layout. */}
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-brand-deep/75">
          {project.title} is not {builderPossessive} first project in{' '}
          {project.location ?? 'the area'}.{' '}
          {previous.length > 0 && (
            <>
              {previous.map((e) => e.name).filter(Boolean).join(' and ')}{' '}
              {previous.length === 1
                ? 'is an existing development'
                : 'are existing developments'}{' '}
              by the same builder nearby &mdash; standing today, and open to anyone who wants to
              see the work before committing to a pre-launch booking.
            </>
          )}
        </p>

        <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e, i) => (
            <li
              key={e.id ?? `${e.name}-${i}`}
              className={`relative rounded-xl border p-6 ${
                e.isCurrent
                  ? 'border-gold bg-white shadow-luxe-sm'
                  : 'border-brand-deep/10 bg-white/60'
              }`}
            >
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/40">
                {e.isCurrent ? 'Now' : `Step ${i + 1}`}
              </span>
              <p className="mt-2 flex items-start gap-2 font-serif text-xl text-brand-deep">
                {e.isCurrent && (
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden />
                )}
                {e.name}
              </p>
              {e.location && (
                <p className="mt-1 text-sm text-brand-deep/60">{e.location}</p>
              )}
              {e.detail && (
                <p className="mt-3 text-sm font-medium text-brand-deep/80">{e.detail}</p>
              )}
            </li>
          ))}
        </ol>

        {story?.slug && (
          <p className="mt-8">
            <Link
              href={`/blog/${story.slug}`}
              className="group inline-flex items-center gap-2 text-sm font-medium text-gold underline underline-offset-4 hover:text-brand-deep"
            >
              Read the full {builder} track record
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
