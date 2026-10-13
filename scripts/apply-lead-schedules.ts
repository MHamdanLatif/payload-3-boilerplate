/** Scoped rollout for databases with historical, manually applied migrations. */
import { mkdir, writeFile } from 'node:fs/promises'
import { createLocalReq, getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../src/payload.config'
import { up } from '../src/migrations/20261012_000000_lead_schedules'

if (process.env.NODE_ENV !== 'production' || process.env.APPLY_LEAD_SCHEDULES !== 'true')
  throw new Error(
    'Set NODE_ENV=production and APPLY_LEAD_SCHEDULES=true for this reviewed rollout.',
  )

const name = '20261012_000000_lead_schedules'
const payload = await getPayload({ config })
const req = await createLocalReq({}, payload)
try {
  await payload.db.drizzle.transaction(async (db) => {
    await db.execute(sql`SET LOCAL lock_timeout = '10s'`)
    await db.execute(sql`SET LOCAL statement_timeout = '60s'`)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${name}))`)
    const tables = [
      'payload_locked_documents_rels',
      'payload_migrations',
      'lead_schedules',
      'schedule_revisions',
    ]
    const backup: Record<string, unknown> = {
      migration: name,
      capturedAt: new Date().toISOString(),
      columns: (
        await db.execute(
          sql`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('payload_locked_documents_rels','payload_migrations','lead_schedules','schedule_revisions') ORDER BY table_name,ordinal_position`,
        )
      ).rows,
      constraints: (
        await db.execute(
          sql`SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN (SELECT oid FROM pg_class WHERE relname IN ('payload_locked_documents_rels','payload_migrations','lead_schedules','schedule_revisions') AND relnamespace='public'::regnamespace)`,
        )
      ).rows,
      indexes: (
        await db.execute(
          sql`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('payload_locked_documents_rels','payload_migrations','lead_schedules','schedule_revisions')`,
        )
      ).rows,
    }
    for (const table of tables) {
      const exists = (await db.execute(sql`SELECT to_regclass(${`public.${table}`}) AS relation`))
        .rows[0]?.relation
      if (exists) backup[table] = (await db.execute(sql.raw(`SELECT * FROM "${table}"`))).rows
    }
    await mkdir('tmp/lead-schedules-release', { recursive: true })
    const backupPath = `tmp/lead-schedules-release/before-${Date.now()}.json`
    await writeFile(backupPath, JSON.stringify(backup, null, 2), { mode: 0o600 })
    console.log(`Affected schema and records backed up to ${backupPath}`)
    await up({ db, payload, req })
    await db.execute(
      sql`SELECT id,lead_id,title,entry_key,created_at,updated_at FROM lead_schedules LIMIT 0`,
    )
    await db.execute(
      sql`SELECT id,schedule_id,revision,revision_key,settings,buyer_name,buyer_phone,note,created_by_id,created_at,updated_at FROM schedule_revisions LIMIT 0`,
    )
    await db.execute(sql`INSERT INTO payload_migrations (name,batch)
      SELECT ${name},COALESCE(MAX(batch) FILTER (WHERE batch > 0),0)+1 FROM payload_migrations
      HAVING NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name=${name})`)
  })
  console.log(`${name} applied and recorded. Existing lead and finance records were not changed.`)
} finally {
  await payload.destroy()
}
