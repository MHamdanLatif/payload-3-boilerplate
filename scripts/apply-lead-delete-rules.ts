/** Scoped rollout for databases with historical, manually applied migrations. */
import { mkdir, writeFile } from 'node:fs/promises'
import { createLocalReq, getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../src/payload.config'
import { up } from '../src/migrations/20261021_000001_lead_delete_rules'

if (process.env.NODE_ENV !== 'production' || process.env.APPLY_LEAD_DELETE_RULES !== 'true')
  throw new Error(
    'Set NODE_ENV=production and APPLY_LEAD_DELETE_RULES=true for this reviewed rollout.',
  )

const name = '20261021_000001_lead_delete_rules'
const tables = ['lead_schedules', 'schedule_revisions', 'payload_migrations']
const payload = await getPayload({ config })
const req = await createLocalReq({}, payload)
try {
  await payload.db.drizzle.transaction(async (db) => {
    await db.execute(sql`SET LOCAL lock_timeout = '10s'`)
    await db.execute(sql`SET LOCAL statement_timeout = '60s'`)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${name}))`)
    for (const table of ['leads', 'users', 'lead_schedules', 'schedule_revisions']) {
      const exists = (await db.execute(sql`SELECT to_regclass(${`public.${table}`}) AS relation`))
        .rows[0]?.relation
      if (!exists)
        throw new Error(`${table} is missing. Apply 20261012_000000_lead_schedules first.`)
    }
    // Only constraints change; rows are captured so a reviewed restore is possible.
    const backup: Record<string, unknown> = {
      migration: name,
      capturedAt: new Date().toISOString(),
      columns: (
        await db.execute(
          sql`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('lead_schedules','schedule_revisions') ORDER BY table_name,ordinal_position`,
        )
      ).rows,
      constraints: (
        await db.execute(
          sql`SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('public.lead_schedules'::regclass,'public.schedule_revisions'::regclass)`,
        )
      ).rows,
    }
    for (const table of tables)
      backup[table] = (await db.execute(sql.raw(`SELECT * FROM "${table}"`))).rows
    await mkdir('tmp/lead-delete-rules-release', { recursive: true })
    const backupPath = `tmp/lead-delete-rules-release/before-${Date.now()}.json`
    await writeFile(backupPath, JSON.stringify(backup, null, 2), { mode: 0o600 })
    console.log(`Affected schema and records backed up to ${backupPath}`)
    await up({ db, payload, req })
    // Verify the end state inside the transaction; any mismatch rolls back.
    const rules = (
      await db.execute(sql`SELECT conrelid::regclass::text AS table_name,a.attname AS column_name,con.confdeltype AS on_delete
        FROM pg_constraint con JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=con.conkey[1]
        WHERE con.contype='f' AND con.conrelid IN ('public.lead_schedules'::regclass,'public.schedule_revisions'::regclass)
          AND a.attname IN ('lead_id','schedule_id','created_by_id')`)
    ).rows as { table_name: string; column_name: string; on_delete: string }[]
    const expected: Record<string, string> = { lead_id: 'c', schedule_id: 'c', created_by_id: 'n' }
    for (const [column, onDelete] of Object.entries(expected)) {
      const found = rules.filter((r) => r.column_name === column)
      if (found.length !== 1 || found[0].on_delete !== onDelete)
        throw new Error(`Unexpected foreign key state for ${column}: ${JSON.stringify(found)}`)
    }
    const nullable = (
      await db.execute(
        sql`SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='schedule_revisions' AND column_name='created_by_id'`,
      )
    ).rows[0]?.is_nullable
    if (nullable !== 'YES') throw new Error('schedule_revisions.created_by_id is still NOT NULL.')
    await db.execute(sql`INSERT INTO payload_migrations (name,batch)
      SELECT ${name},COALESCE(MAX(batch) FILTER (WHERE batch > 0),0)+1 FROM payload_migrations
      HAVING NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name=${name})`)
  })
  console.log(`${name} applied and recorded. No lead, schedule or finance rows were changed.`)
} finally {
  await payload.destroy()
}
