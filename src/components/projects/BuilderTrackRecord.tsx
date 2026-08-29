import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Blog, FeaturedProject, Media } from '@/payload-types'
import { imageAlt, imageUrl } from '@/lib/featured-projects'
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
 * is verifiable. That is why each card carries a photograph of the finished
 * building, a location and one concrete number rather than prose - a standing
 * tower photographed on the street is evidence in a way a render is not.
 *
 * All copy is derived from the entries, so the block reads correctly for any
 * builder without hardcoding this project's names. Server component - no client
 * JS. Renders nothing when fewer than two entries exist, so projects without a
 * track record are unaffected.
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
  const area = project.location ?? 'Karachi'

  const previous = entries.filter((e) => !e.isCurrent)
  const current = entries.find((e) => e.isCurrent) ?? entries[entries.length - 1]
  // The editor's spelling of this project inside the track record wins over the
  // CMS title, so the section does not mix "Tulip Comfort" with "Tulip Comforts".
  const currentName = current?.name || project.title

  // "Safoora Chowrangi, Scheme 33" -> "Safoora Chowrangi" for the prose, which
  // already names the wider area in the sentence before.
  const shortArea = (value?: string | null) => value?.split(',')[0]?.trim() || null

  const first = previous[0]
  const last = previous[previous.length - 1]
  const headline =
    previous.length >= 2 ? `From ${first?.name} to ${last?.name}.` : `After ${first?.name}.`

  return (
    <section className="bg-cream/40 py-20 md:py-28">
      <div className="container">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">{sectionNumber}</span>
          <span className="h-px w-10 bg-gold" />
        </div>

        <h2 className="mt-6 max-w-3xl font-serif text-3xl leading-tight tracking-tight text-brand-deep md:text-4xl">
          {headline}
          <br />
          <span className="text-gold">Now, {currentName}.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-sm uppercase tracking-[0.12em] text-brand-deep/55">
          An established development presence in {area} by {builder}.
        </p>
        <SectionRule className="mt-6" />

        {/* The crawlable sentence. A buyer researching "is Al Wahab reliable"
            should find this answered in text, not inferred from a card layout. */}
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-brand-deep/75">
          {currentName} continues an existing {builder} development footprint in {area}.{' '}
          {previous.length >= 2 ? (
            <>
              From {first?.name}
              {shortArea(first?.location) ? ` at ${shortArea(first?.location)}` : ''} to {last?.name}
              , these are completed developments that buyers can see on the ground today &mdash;
              providing a tangible track record behind the next project.
            </>
          ) : (
            <>
              {first?.name}
              {shortArea(first?.location) ? ` at ${shortArea(first?.location)}` : ''} is a completed
              development that buyers can see on the ground today &mdash; a tangible track record
              behind the next project.
            </>
          )}
        </p>

        <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e, i) => {
            const media = (e.image ?? null) as number | Media | null
            const src = imageUrl(media)
            const facts = [e.detail, e.completedYear ? `Completed ${e.completedYear}` : null]
              .filter(Boolean)
              .join(' · ')
            // The connector only makes sense between cards on the same row, and
            // the grid is three-wide only at lg.
            const showArrow = i < entries.length - 1 && (i + 1) % 3 !== 0

            return (
              <li key={e.id ?? `${e.name}-${i}`} className="relative">
                <article
                  className={`flex h-full flex-col overflow-hidden rounded-xl border ${
                    e.isCurrent
                      ? 'border-gold bg-white shadow-luxe-sm'
                      : 'border-brand-deep/10 bg-white/60'
                  }`}
                >
                  <div className="flex items-baseline gap-3 px-6 pb-4 pt-5">
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/40">
                      {e.isCurrent ? 'Now' : `Step ${i + 1}`}
                    </span>
                    <h3 className="font-serif text-xl leading-tight text-brand-deep">{e.name}</h3>
                  </div>

                  {src && (
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-deep/5">
                      <Image
                        src={src}
                        alt={imageAlt(
                          media,
                          `${e.name}${e.location ? `, ${e.location}` : ''} by ${builder}`,
                        )}
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
                    {e.location && <p className="text-sm text-brand-deep/60">{e.location}</p>}
                    {facts && (
                      <p className="mt-2 text-sm font-medium text-brand-deep/85">{facts}</p>
                    )}
                    {e.statusLine && (
                      <p
                        className={`mt-auto pt-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${
                          e.isCurrent ? 'text-gold' : 'text-brand-deep/45'
                        }`}
                      >
                        {e.statusLine}
                      </p>
                    )}
                  </div>
                </article>

                {showArrow && (
                  <span
                    aria-hidden
                    className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-[calc(50%+0.625rem)] rounded-full bg-cream p-1 text-gold lg:block"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </li>
            )
          })}
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
