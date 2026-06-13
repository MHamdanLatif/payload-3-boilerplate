import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function BlogNotFound() {
  return (
    <main className="flex min-h-[70vh] items-center bg-ivory py-32">
      <div className="container max-w-2xl text-center">
        <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
          404 · ARTICLE
        </span>
        <h1 className="mt-5 font-serif text-5xl leading-tight tracking-tight text-brand-deep md:text-6xl">
          We couldn&rsquo;t find that article.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-brand-deep/70 md:text-lg">
          It may have been moved or the URL is incorrect. Browse the rest of the blog
          for more buyer guides and market commentary.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/blog"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold hover:text-brand-deep"
          >
            Back to Blog
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </main>
  )
}
