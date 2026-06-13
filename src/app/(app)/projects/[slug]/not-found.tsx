import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function ProjectNotFound() {
  return (
    <main className="flex min-h-[70vh] items-center bg-ivory py-32">
      <div className="container max-w-2xl text-center">
        <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
          404 · PROJECT
        </span>
        <h1 className="mt-5 font-serif text-5xl leading-tight tracking-tight text-brand-deep md:text-6xl">
          We couldn&rsquo;t find that project.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-brand-deep/70 md:text-lg">
          It may have been delisted or the URL may be incorrect. Browse the full live
          inventory or send us your requirements — our advisors source off-market
          options daily.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/properties"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold hover:text-brand-deep"
          >
            See all properties
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link
            href="/#contact"
            className="inline-flex items-center gap-2 rounded-full border border-brand-deep/25 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep transition-all duration-300 hover:border-brand-deep hover:bg-brand-deep hover:text-white"
          >
            Talk to an advisor
          </Link>
        </div>
      </div>
    </main>
  )
}
