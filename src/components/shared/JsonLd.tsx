/**
 * Server component that emits one or more `<script type="application/ld+json">`
 * blocks. Pass a schema object, an array of schema objects, or null (skips).
 * Use anywhere inside a page render — Next.js will hoist scripts that belong
 * in <head> automatically; this lives in the body and that's fine for crawlers.
 */
type SchemaObject = Record<string, unknown> | null | undefined

export function JsonLd({ data }: { data: SchemaObject | SchemaObject[] }) {
  if (!data) return null
  const arr = Array.isArray(data) ? data : [data]
  const valid = arr.filter((d): d is Record<string, unknown> => !!d)
  if (!valid.length) return null
  return (
    <>
      {valid.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          // JSON.stringify handles escaping; we control the input shape so no XSS risk.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  )
}
