import { ChevronDown } from 'lucide-react'
import { SectionRule } from '@/components/landing/SectionRule'

export type FaqItem = { question: string; answer: string }

type Props = {
  faqs: FaqItem[] | null | undefined
  sectionNumber?: string
  heading?: string
}

/**
 * Server-rendered FAQ section. Uses native <details>/<summary> so there's no
 * client JS — the disclosure widget is browser-native and SEO-friendly.
 * Renders nothing when there are no FAQs.
 *
 * IMPORTANT: When FAQs render here, the page must ALSO inject `faqPageSchema()`
 * JSON-LD at the page top so the visible content and structured data match.
 * Google's policy (since 2023) requires this for FAQPage rich results to fire.
 */
export function FaqSection({
  faqs,
  sectionNumber = '06 / FAQ',
  heading = 'Frequently asked',
}: Props) {
  const list = (faqs ?? []).filter((f) => f?.question && f?.answer)
  if (!list.length) return null

  return (
    <section className="bg-ivory py-20 md:py-28">
      <div className="container max-w-4xl">
        <div className="mb-10 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              {sectionNumber}
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl">
            {heading}
          </h2>
          <SectionRule className="mt-6" />
        </div>

        <ul className="divide-y divide-brand-deep/10 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white shadow-luxe-sm">
          {list.map((faq, i) => (
            <li key={`${faq.question}-${i}`}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 px-6 py-5 transition-colors duration-300 hover:bg-cream md:px-8 md:py-6">
                  <span className="font-serif text-lg leading-tight text-brand-deep md:text-xl">
                    {faq.question}
                  </span>
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-deep/15 text-brand-deep/60 transition-all duration-300 group-open:rotate-180 group-open:border-gold group-open:text-gold">
                    <ChevronDown className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                </summary>
                <div className="px-6 pb-6 text-sm leading-relaxed text-brand-deep/75 md:px-8 md:pb-8 md:text-base">
                  {faq.answer.split(/\n\n+/).map((para, pi) => (
                    <p key={pi} className={pi > 0 ? 'mt-3' : ''}>
                      {para}
                    </p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
