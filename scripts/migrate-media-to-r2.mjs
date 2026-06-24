// One-shot: upload every file in public/media/ to Cloudflare R2 under the same
// key (filename). Existing Payload DB rows reference these filenames, so as
// soon as the bytes land in R2 every project page stops 500'ing.
//
// Safe to re-run — uploads with the same key replace the existing object.
// Skip any file that already exists (checked via HEAD) to keep runs idempotent.
//
// Usage:
//   node scripts/migrate-media-to-r2.mjs
//
// Reads R2 credentials from .env (S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID,
// S3_SECRET_ACCESS_KEY).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, extname, basename } from 'node:path'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=')
    if (i === -1) return acc
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    acc[k] = v
    return acc
  }, {})

const required = ['S3_BUCKET', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
for (const k of required) {
  if (!env[k]) {
    console.error(`missing required env var: ${k}`)
    process.exit(1)
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
})

const CONTENT_TYPE = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

async function objectExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
    return true
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false
    throw e
  }
}

async function upload(filepath) {
  const key = basename(filepath)
  if (await objectExists(key)) {
    console.log(`skip (exists): ${key}`)
    return
  }
  const body = readFileSync(filepath)
  const contentType = CONTENT_TYPE[extname(key).toLowerCase()] || 'application/octet-stream'
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // R2 honours these but the proxied serve path doesn't need them.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  console.log(`ok: ${key} (${body.length.toLocaleString()} bytes)`)
}

const dir = resolve('public/media')
const files = readdirSync(dir)
  .map((f) => join(dir, f))
  .filter((f) => statSync(f).isFile())

console.log(`uploading ${files.length} file(s) to s3://${env.S3_BUCKET}/`)
let ok = 0
let skipped = 0
let failed = 0
for (const f of files) {
  try {
    const before = await objectExists(basename(f))
    await upload(f)
    if (before) skipped++
    else ok++
  } catch (e) {
    failed++
    console.warn(`failed: ${basename(f)} — ${e?.message ?? e}`)
  }
}
console.log(`\ndone. uploaded=${ok} skipped=${skipped} failed=${failed}`)
