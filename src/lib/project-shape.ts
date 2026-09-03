import type { FeaturedProject } from '@/payload-types'

/**
 * Structural types shared by the organic project page and the paid landing page.
 *
 * `featured-projects` and `marketed-projects` are deliberately separate
 * collections holding separate copies of the same content, so no component can
 * be typed against one concrete document and still serve the other. Rather than
 * forking the units table, the calculator and the track-record block — three of
 * the most fiddly components in the codebase — each is widened to accept the
 * narrowest shape it actually reads.
 *
 * These are derived from `FeaturedProject` rather than hand-written so that a
 * field rename on the organic collection breaks the build here, instead of
 * quietly diverging. `MarketedProject` satisfies them structurally because it
 * reuses the same option constants and the same `required` flags; if the two
 * ever drift, `tsc` says so at the call site.
 *
 * Note what is NOT in here: `propertyType` is required on `FeaturedProject` and
 * absent from `MarketedProject`, which is precisely why a marketed document
 * cannot simply be cast to a `FeaturedProject`.
 */

export type ProjectUnit = NonNullable<FeaturedProject['unitTypes']>[number]

/** Anything that carries a unit mix — the input to every derived unit fact. */
export type UnitsSource = {
  unitTypes?: ProjectUnit[] | null
}

/** What the units table renders: the mix, plus what to call the project. */
export type UnitsTableSource = UnitsSource & {
  title: string
  slug?: string | null
  location?: FeaturedProject['location']
}

/** What the payment calculator and its PDF gate read. */
export type PaymentPlanSource = UnitsTableSource & {
  startingPrice?: number | null
  paymentPlan?: FeaturedProject['paymentPlan']
}

/**
 * What the builder track-record block reads.
 *
 * `builderStory` is optional here and simply absent on `MarketedProject` — an ad
 * page has no business linking out to a blog post — and an object type missing
 * an optional property still satisfies the constraint.
 */
export type TrackRecordSource = {
  title: string
  builderName: string
  location?: FeaturedProject['location']
  builderTrackRecord?: FeaturedProject['builderTrackRecord']
  builderStory?: FeaturedProject['builderStory']
}

/** What the hero and link previews need to find an image. */
export type ElevationSource = {
  elevationImages?: FeaturedProject['elevationImages']
}
