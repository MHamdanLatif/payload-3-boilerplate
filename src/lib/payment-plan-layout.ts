import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import type { Media } from '@/payload-types'

/** Use the CMS asset reference, never an arbitrary URL supplied in a plan request. */
export async function loadUnitLayout(media: Media | number | null | undefined, serverURL: string) {
  if (!media || typeof media !== 'object') return null
  if (!media.url) throw new Error('The unit layout has no downloadable file. Update it in the CMS.')
  const response = await fetch(new URL(media.url, serverURL), {
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error('Could not load the unit layout. Please try again.')
  if (Number(response.headers.get('content-length')) > 20_000_000)
    throw new Error('Unit layout exceeds 20 MB.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 20_000_000) throw new Error('Unit layout exceeds 20 MB.')
  if (media.mimeType === 'application/pdf' || bytes.subarray(0, 5).toString() === '%PDF-')
    return { pdf: bytes, image: undefined }
  const png = await sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2000, height: 2400, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  return { image: `data:image/png;base64,${png.toString('base64')}`, pdf: undefined }
}

export async function appendLayoutPDF(schedule: Buffer, layout?: Buffer): Promise<Uint8Array> {
  if (!layout) return new Uint8Array(schedule)
  const document = await PDFDocument.load(schedule)
  const attachment = await PDFDocument.load(layout)
  if (attachment.getPageCount() > 20) throw new Error('Unit layout must contain at most 20 pages.')
  const pages = await document.copyPages(attachment, attachment.getPageIndices())
  pages.forEach((page) => document.addPage(page))
  return document.save()
}
