import type { FeaturedProject, MarketedProject } from '@/payload-types'

/** Copy only fields supported by the campaign schema; omit row IDs. */
export function marketingPageCopy(project: FeaturedProject, slug: string) {
  const relationID = <T extends { id: number }>(value: number | T | null | undefined) =>
    typeof value === 'object' && value ? value.id : value
  const photos = (rows: FeaturedProject['elevationImages']) =>
    rows.map(({ image, caption }) => ({ image: relationID(image)!, caption }))

  return {
    title: project.title,
    slug,
    active: false,
    linkedProject: project.id,
    salesAvailability: project.salesAvailability,
    builderMarketingNotes: project.builderMarketingNotes,
    builderName: project.builderName,
    projectType: project.projectType,
    startingPrice: project.startingPrice,
    location: project.location,
    status: project.status,
    summary: project.summary,
    elevationImages: photos(project.elevationImages),
    brochure: relationID(project.brochure),
    walkthroughVideoUrl: project.walkthroughVideoUrl,
    builderTrackRecord: project.builderTrackRecord?.map(({ id: _id, image, ...row }) => ({
      ...row, image: relationID(image),
    })),
    photoGallery: photos(project.photoGallery ?? []),
    amenities: project.amenities?.map(({ name }) => ({ name })),
    googleMapsEmbedUrl: project.googleMapsEmbedUrl,
    availableUnits: project.unitTypes?.filter((unit) => !unit.soldOut).map((unit) => ({
      name: unit.name,
      type: unit.isDuplex ? `${unit.type} (Duplex)` : unit.type,
      areaSqFt: unit.areaSqFt,
    })),
  } satisfies Omit<MarketedProject, 'id' | 'createdAt' | 'updatedAt'>
}
