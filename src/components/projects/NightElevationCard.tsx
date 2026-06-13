import Image from 'next/image'
import type { FeaturedProject, Media } from '@/payload-types'
import { imageUrl, imageAlt } from '@/lib/featured-projects'

export function NightElevationCard({ project }: { project: FeaturedProject }) {
  const night = project.nightElevation as Media | null | undefined
  const src = imageUrl(night)
  if (!src) return null
  const alt = imageAlt(night, `${project.title} at night`)

  return (
    <section className="relative bg-ivory py-12 md:py-20">
      <div className="container">
        <div className="relative isolate overflow-hidden rounded-3xl shadow-luxe">
          <Image
            src={src}
            alt={alt}
            width={1920}
            height={1080}
            sizes="(min-width: 1024px) 80vw, 100vw"
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/90 via-brand-deep/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="container">
              <div className="max-w-lg text-white">
                <p className="eyebrow text-gold">After Hours</p>
                <h3 className="mt-4 font-serif text-3xl leading-tight tracking-tight md:text-4xl lg:text-5xl">
                  Designed for evenings that linger.
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-white/80 md:text-base">
                  Considered façade lighting, landscape uplights and quiet glass — the building
                  performs as well at dusk as it does at noon.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
