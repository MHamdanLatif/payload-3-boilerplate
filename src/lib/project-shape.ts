import type { FeaturedProject } from '@/payload-types'

/**
 * Narrow shapes used by project components. Detailed unit and payment-plan
 * shapes belong to organic projects; marketed projects have a separate simple
 * availability list and share only elevation and builder-track-record shapes.
 * Derive organic fields from FeaturedProject so schema changes remain checked.
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
