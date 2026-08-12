/**
 * Authored copy for the location silo.
 *
 * The nine location pages are generated from a hardcoded entity list
 * (`LOCATION_ENTITIES` in project-mapper.ts), so until now every one of them
 * shared an identical hero paragraph and an identical templated meta
 * description — a near-duplicate cluster in the index. This map lets the pages
 * that actually earn impressions carry real, differentiated copy; any slug
 * absent here falls back to the previous generic template, so partial coverage
 * is fine and adding a location is additive.
 *
 * Only the three locations with meaningful Search Console visibility are
 * covered:
 *   gulistan-e-johar   531 impressions, position 11.09  (+ the Kamran
 *                      Chowrangi query cluster: ~344 impressions, 0 clicks)
 *   gulshan-e-iqbal    368 impressions, position 10.18
 *   scheme-33          309 impressions, position  8.65
 *
 * DELIBERATELY NO PRICES. Static price copy goes stale and then contradicts the
 * live project and listing cards rendered directly below it on the same page.
 * Anything numeric and volatile belongs in the CMS, not here.
 *
 * FAQs feed both the on-page <FaqSection> and FAQPage structured data, so
 * answers must be factual and self-contained — they can appear on their own in
 * a search result, detached from the surrounding page.
 */

export type LocationFaq = { question: string; answer: string }

export type LocationContent = {
  /** Page <h1>. Keyword-qualified, not the bare area name. */
  h1: string
  /** Lead paragraph under the h1. 2–3 sentences. */
  intro: string
  /** Optional second paragraph for sub-areas or corridors worth naming. */
  detail?: string
  /** ≤60 chars. */
  metaTitle: string
  /** ≤155 chars. */
  metaDescription: string
  faqs: LocationFaq[]
}

export const LOCATION_CONTENT: Record<string, LocationContent> = {
  'gulistan-e-johar': {
    h1: 'Property for Sale in Gulistan-e-Johar, Karachi',
    intro:
      'Gulistan-e-Johar is one of Karachi’s most established apartment markets — a dense, fully serviced neighbourhood where most buying activity is flats rather than plots. Its appeal is everyday practicality: schools, hospitals, markets and transport are already in place, so an apartment here is liveable from possession day rather than dependent on an area still being built out.',
    detail:
      'The Kamran Chowrangi corridor and Block 11 sit at the centre of that demand. The junction connects Johar to Rashid Minhas Road and University Road, which is what keeps commute times workable to Gulshan-e-Iqbal, the airport and the wider city — and why apartment projects cluster within a short radius of it. Blocks nearer the main arteries typically command a premium over the interior lanes.',
    metaTitle: 'Property for Sale in Gulistan-e-Johar, Karachi',
    metaDescription:
      'Apartments and commercial property for sale in Gulistan-e-Johar, Karachi — Block 11 and the Kamran Chowrangi corridor. Current projects and resale.',
    faqs: [
      {
        question: 'Is Gulistan-e-Johar a good area to buy an apartment in Karachi?',
        answer:
          'It suits buyers who want a settled, fully serviced neighbourhood rather than an emerging one. Schools, hospitals, markets and transport links already exist, and the apartment stock is deep enough that there is usually resale as well as new-project inventory to compare. That maturity also means fewer of the price jumps you see in areas still being developed.',
      },
      {
        question: 'What is the Kamran Chowrangi advantage in Gulistan-e-Johar?',
        answer:
          'Kamran Chowrangi is the junction that links Gulistan-e-Johar to Rashid Minhas Road and University Road. Projects within a short radius of it tend to hold demand better because the daily commute to Gulshan-e-Iqbal, the airport and central Karachi stays practical. Blocks closer to these main roads generally price above the interior lanes.',
      },
      {
        question: 'Which blocks in Gulistan-e-Johar have the most apartment projects?',
        answer:
          'Block 11 and the blocks along the main corridors carry most of the apartment activity, because they combine road access with the plot sizes that suit residential towers. Interior blocks are quieter and usually cheaper per square foot, at the cost of a longer run to the main road.',
      },
      {
        question: 'Can I buy an apartment in Gulistan-e-Johar on an installment plan?',
        answer:
          'Yes. Pre-launch and under-construction projects in the area are normally sold on a down payment followed by monthly or quarterly installments through to possession, with terms set by each builder. The projects listed on this page show their own payment plans, and our advisors can walk through what a specific unit works out to.',
      },
    ],
  },

  'gulshan-e-iqbal': {
    h1: 'Property for Sale in Gulshan-e-Iqbal, Karachi',
    intro:
      'Gulshan-e-Iqbal is central Karachi in the practical sense — close to University Road, NIPA and the main routes to the airport and the city centre. It is a mature, mixed neighbourhood, so buying here is usually a decision about a specific block and building rather than about the area proving itself.',
    detail:
      'Because the area is largely built out, the market is dominated by resale apartments and selective new towers on the larger plots, with commercial frontage along the main roads. That mix means available inventory changes quickly and is worth checking against current listings rather than older guides.',
    metaTitle: 'Property for Sale in Gulshan-e-Iqbal, Karachi',
    metaDescription:
      'Apartments, flats and commercial property for sale in Gulshan-e-Iqbal, Karachi. Current projects, resale listings and payment plans from Lateef Properties.',
    faqs: [
      {
        question: 'Why do buyers choose Gulshan-e-Iqbal over newer Karachi areas?',
        answer:
          'Location and certainty. Gulshan-e-Iqbal is already connected to University Road and the main routes toward the airport and central Karachi, and its schools, hospitals and markets are long established. Buyers who need somewhere liveable immediately tend to prefer it to an area whose amenities are still promised.',
      },
      {
        question: 'What kind of property is available in Gulshan-e-Iqbal?',
        answer:
          'Mostly apartments — a mix of resale flats in established buildings and a smaller number of new towers on the larger plots — plus commercial units along the main roads. Because the area is largely built out, plot availability is limited compared with developing areas such as Scheme 33.',
      },
      {
        question: 'How is Gulshan-e-Iqbal connected to the rest of Karachi?',
        answer:
          'It sits on and around University Road with access to Rashid Minhas Road, which links it to the airport, Gulistan-e-Johar and the city centre. That road access is a large part of why the area holds its demand, and why buildings near the main corridors usually price above the interior blocks.',
      },
      {
        question: 'Is Gulshan-e-Iqbal a good area for rental income?',
        answer:
          'It is a consistent rental market, largely because of steady tenant demand from nearby universities, hospitals and offices. Yield depends heavily on the specific building, floor and condition rather than on the area alone, so it is worth comparing actual asking rents in the exact block before committing.',
      },
    ],
  },

  'scheme-33': {
    h1: 'Property for Sale in Scheme 33, Karachi',
    intro:
      'Scheme 33 is where much of Karachi’s new apartment supply is being built. Its draw is straightforward: newer buildings, larger unit sizes for the money than the established central areas, and pre-launch pricing on projects still under construction — which is also why buying here is more about choosing the right developer and payment plan than about the address alone.',
    detail:
      'The area spreads across Gulzar-e-Hijri and the sectors around Safoora Chowrangi, with access via University Road and the Super Highway (M-9) and Karachi University nearby. Location within Scheme 33 matters more than in a settled neighbourhood — a project close to Safoora Chowrangi or a main approach road is a materially different proposition from one deep inside a sector still being developed.',
    metaTitle: 'Property for Sale in Scheme 33, Karachi',
    metaDescription:
      'Apartments and flats for sale in Scheme 33, Karachi — Gulzar-e-Hijri and Safoora Chowrangi. Pre-launch and under-construction projects on installments.',
    faqs: [
      {
        question: 'Where exactly is Scheme 33 in Karachi?',
        answer:
          'Scheme 33 covers a large area in the north-east of the city, spanning Gulzar-e-Hijri and the sectors around Safoora Chowrangi, reached via University Road and the Super Highway (M-9), with Karachi University nearby. Because it is so large, two projects both described as "Scheme 33" can be some distance apart — always check the sector and the nearest main road.',
      },
      {
        question: 'Why is Scheme 33 popular for new apartment projects?',
        answer:
          'Land availability. Unlike the built-out central neighbourhoods, Scheme 33 still has plots suited to new residential towers, which is why most of Karachi’s pre-launch and under-construction apartment supply is concentrated there. For buyers that usually means newer construction and more space for the money, in exchange for waiting through a construction period.',
      },
      {
        question: 'Should I buy a pre-launch apartment in Scheme 33?',
        answer:
          'Pre-launch pricing is lower than possession-ready pricing because you are taking on construction and timeline risk. Whether that trade is worth it comes down to the developer’s delivery record, the approval status of the project and how the payment plan is structured. Check those three things before the price — a good price on a project that does not complete on time is not a good deal.',
      },
      {
        question: 'What should I check before buying in Scheme 33?',
        answer:
          'Confirm the exact sector and the nearest main approach road, since travel times vary widely across the area. Then confirm the project’s approval status and the builder’s record on previous completions, and read the payment plan through to possession so you know what falls due during construction and what is payable at handover.',
      },
    ],
  },
}

export function locationContent(slug: string): LocationContent | null {
  return LOCATION_CONTENT[slug] ?? null
}
