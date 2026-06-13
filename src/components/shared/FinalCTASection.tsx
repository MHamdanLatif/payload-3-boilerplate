import { LeadForm, type LeadFormSourceKind } from '@/components/forms/LeadForm'

type Props = {
  sourceName: string
  sourceSlug: string
  sourceKind: LeadFormSourceKind
  sectionNumber?: string
  /** Pre-form copy on the left column. */
  intro?: string
  /** Italic accent at the end of the H2. */
  italicAccent?: string
}

export function FinalCTASection({
  sourceName,
  sourceSlug,
  sourceKind,
  sectionNumber = '05 / ENQUIRE',
  intro = 'Share your details — a senior advisor will reach you within 24 hours with availability, pricing, and a viewing slot.',
  italicAccent,
}: Props) {
  const accent = italicAccent ?? sourceName
  const whatsappMessage = `Hi, I'm interested in ${sourceName}. Please share details.`

  return (
    <section
      id="enquire"
      className="relative overflow-hidden bg-brand-gradient py-20 text-white md:py-28"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--gold)/0.15),transparent_55%)]" />

      <div className="container grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">{sectionNumber}</span>
          <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight text-balance md:text-5xl lg:text-6xl">
            Ready to see{' '}
            <span className="italic text-gold">{accent}?</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/80 md:text-lg">
            {intro}
          </p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <p className="eyebrow text-gold">Prefer instant?</p>
            <a
              href={`https://wa.me/923363528333?text=${encodeURIComponent(whatsappMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 font-serif text-xl text-white transition-colors hover:text-gold"
            >
              WhatsApp +92-3363-LATEEF
            </a>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-8">
            <LeadForm
              sourceName={sourceName}
              sourceSlug={sourceSlug}
              sourceKind={sourceKind}
              placement="final"
              tone="dark"
              submitLabel="Get in Touch"
              footnote="We'll call within 24 hours. Your details stay private."
            />
          </div>
        </div>
      </div>
    </section>
  )
}
