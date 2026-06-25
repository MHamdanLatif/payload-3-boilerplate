// One-shot: delete every object in the R2 bucket whose key has an image or
// PDF extension. Anything else (markdown, JSON, .DS_Store, txt, etc.) is left
// untouched as a guardrail — though in practice the bucket only holds the
// 42 files the migration script put there.
//
// Usage:
//   node scripts/purge-r2-media.mjs
//
// Lists everything first, prints the filtered delete plan, asks for no
// confirmation (idempotent — safe to re-run; deleting a non-existent key
// is a no-op).
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

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

// Allow-list — only these extensions get deleted. Defensive: if anything
// else somehow ends up in the bucket, we never touch it.
const ALLOWED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
  '.pdf',
  '.mp4', '.webm', '.mov',
])

const client = new S3Client({
  region: 'auto',
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
})

async function listAll() {
  const keys = []
  let token
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        ContinuationToken: token,
      }),
    )
    if (res.Contents) {
      for (const obj of res.Contents) {
        if (obj.Key) keys.push({ key: obj.Key, size: obj.Size ?? 0 })
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}

const all = await listAll()
console.log(`bucket has ${all.length} object(s) total\n`)

const toDelete = all.filter(({ key }) => ALLOWED_EXT.has(extname(key).toLowerCase()))
const skipped = all.filter(({ key }) => !ALLOWED_EXT.has(extname(key).toLowerCase()))

if (skipped.length > 0) {
  console.log(`skipping ${skipped.length} non-media object(s) (extension not in allow-list):`)
  for (const { key } of skipped) console.log(`  · ${key}`)
  console.log()
}

if (toDelete.length === 0) {
  console.log('nothing to delete — bucket is already clean of media files.')
  process.exit(0)
}

console.log(`deleting ${toDelete.length} media file(s)...\n`)
let ok = 0
let failed = 0
for (const { key, size } of toDelete) {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
    ok++
    console.log(`deleted: ${key} (${size.toLocaleString()} bytes)`)
  } catch (e) {
    failed++
    console.warn(`failed: ${key} — ${e?.message ?? e}`)
  }
}
console.log(`\ndone. deleted=${ok} failed=${failed} skipped=${skipped.length}`)
