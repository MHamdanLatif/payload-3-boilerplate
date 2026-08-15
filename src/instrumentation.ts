/**
 * Memory diagnostics — TEMPORARY, safe to delete once the question is answered.
 *
 * Railway bills memory per minute, and this app averaged ~1.29 GB while its CPU
 * sat near idle. The usage graph is a sawtooth: memory climbs steadily, drops
 * vertically on each restart, then climbs again. So something accumulates and is
 * never released — but from outside the process we cannot tell WHAT.
 *
 * This logs Node's own memory breakdown every 5 minutes. The point is the split
 * between the buckets, not the absolute numbers:
 *
 *   heapUsed / heapTotal  JavaScript objects. Growth here means a code-level
 *                         leak — a cache that never evicts, or references held
 *                         after a request finishes.
 *   external/arrayBuffers Memory outside the JS heap: file and image buffers.
 *                         Growth here points at `sharp` image processing or PDF
 *                         handling, not application logic.
 *   rss                   Total footprint, i.e. what Railway actually bills.
 *                         rss climbing while heap stays flat means native
 *                         allocation or allocator fragmentation, and neither a
 *                         heap cap nor a code fix would help much.
 *
 * Reading a ratio rather than a total is what makes this robust to traffic
 * variation: if visits halve, every number shrinks, but whichever bucket is
 * growing is still the one growing.
 *
 * `heapLimit` is logged once at startup so we know whether capping the heap
 * (--max-old-space-size) would be safe or would just cause OOM crashes.
 *
 * To silence without a code change: set MEMORY_LOG=0 in Railway.
 * Volume is ~288 lines/day.
 */
export async function register() {
  // Next runs this hook in both the Node and Edge runtimes; process.memoryUsage
  // only exists in Node. Dev is excluded because its memory profile is nothing
  // like production's and would only muddy the data.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return
  if (process.env.MEMORY_LOG === '0') return

  const INTERVAL_MS = 5 * 60 * 1000
  const startedAt = Date.now()
  const mb = (bytes: number) => Math.round(bytes / 1048576)

  try {
    const v8 = await import('node:v8')
    const stats = v8.getHeapStatistics()
    console.log(
      `[mem] boot node=${process.version} heapLimit=${mb(stats.heap_size_limit)}MB ` +
        `interval=${INTERVAL_MS / 60000}m`,
    )
  } catch {
    // v8 stats are a nice-to-have; never let them break startup.
  }

  const sample = () => {
    try {
      const m = process.memoryUsage()
      const uptimeMin = Math.round((Date.now() - startedAt) / 60000)
      console.log(
        `[mem] uptime=${uptimeMin}m rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB ` +
          `heapTotal=${mb(m.heapTotal)}MB external=${mb(m.external)}MB ` +
          `arrayBuffers=${mb(m.arrayBuffers)}MB`,
      )
    } catch {
      // Diagnostics must never take the site down.
    }
  }

  sample() // baseline at boot, so the first restart-to-now delta is visible

  const timer = setInterval(sample, INTERVAL_MS)
  // Do not hold the event loop open — without this the process could refuse to
  // exit cleanly on shutdown, which would slow every deploy.
  timer.unref()
}
