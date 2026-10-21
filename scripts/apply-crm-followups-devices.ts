/** Scoped rollout for databases with historical, manually applied migrations. */
import { mkdir, writeFile } from 'node:fs/promises'
import { createLocalReq, getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../src/payload.config'
import { up } from '../src/migrations/20261021_000000_crm_followups_devices'

if (process.env.NODE_ENV !== 'production' || process.env.APPLY_CRM_FOLLOWUPS_DEVICES !== 'true')
  throw new Error(
    'Set NODE_ENV=production and APPLY_CRM_FOLLOWUPS_DEVICES=true for this reviewed rollout.',
  )

const name = '20261021_000000_crm_followups_devices'
const payload = await getPayload({ config })
const req = await createLocalReq({}, payload)
try {
  await payload.db.drizzle.transaction(async (db) => {
    await db.execute(sql`SET LOCAL lock_timeout = '10s'`)
    await db.execute(sql`SET LOCAL statement_timeout = '60s'`)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${name}))`)
    // Every touched table must already exist; this rollout only adds to them.
    for (const table of ['leads', 'lead_notifications', 'push_subscriptions', 'users_sessions']) {
      const exists = (await db.execute(sql`SELECT to_regclass(${`public.${table}`}) AS relation`))
        .rows[0]?.relation
      if (!exists) throw new Error(`Preflight failed: table ${table} is missing.`)
    }
    const names = `'leads','lead_notifications','push_subscriptions','crm_devices','payload_locked_documents_rels','payload_migrations'`
    const backup: Record<string, unknown> = {
      migration: name,
      capturedAt: new Date().toISOString(),
      columns: (
        await db.execute(
          sql.raw(
            `SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN (${names}) ORDER BY table_name,ordinal_position`,
          ),
        )
      ).rows,
      constraints: (
        await db.execute(
          sql.raw(
            `SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN (SELECT oid FROM pg_class WHERE relname IN (${names}) AND relnamespace='public'::regnamespace)`,
          ),
        )
      ).rows,
      indexes: (
        await db.execute(
          sql.raw(
            `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN (${names})`,
          ),
        )
      ).rows,
      // Lead rows are only gaining a nullable column; keep their follow-up state.
      leadFollowUps: (
        await db.execute(
          sql`SELECT id,follow_up_at,follow_up_sent_at,follow_up_status,follow_up_retry_at,follow_up_claim FROM leads WHERE follow_up_at IS NOT NULL`,
        )
      ).rows,
    }
    for (const table of [
      'lead_notifications',
      'push_subscriptions',
      'crm_devices',
      'payload_locked_documents_rels',
      'payload_migrations',
    ]) {
      const exists = (await db.execute(sql`SELECT to_regclass(${`public.${table}`}) AS relation`))
        .rows[0]?.relation
      if (exists) backup[table] = (await db.execute(sql.raw(`SELECT * FROM "${table}"`))).rows
    }
    await mkdir('tmp/crm-followups-devices-release', { recursive: true })
    const backupPath = `tmp/crm-followups-devices-release/before-${Date.now()}.json`
    await writeFile(backupPath, JSON.stringify(backup, null, 2), { mode: 0o600 })
    console.log(`Affected schema and records backed up to ${backupPath}`)
    await up({ db, payload, req })
    await db.execute(sql`SELECT follow_up_repeat_sent_at FROM leads LIMIT 0`)
    await db.execute(sql`SELECT device_attempts FROM lead_notifications LIMIT 0`)
    await db.execute(sql`SELECT session_id FROM push_subscriptions LIMIT 0`)
    await db.execute(
      sql`SELECT id,session_id,owner_id,description,updated_at,created_at FROM crm_devices LIMIT 0`,
    )
    await db.execute(sql`SELECT crm_devices_id FROM payload_locked_documents_rels LIMIT 0`)
    await db.execute(sql`INSERT INTO payload_migrations (name,batch)
      SELECT ${name},COALESCE(MAX(batch) FILTER (WHERE batch > 0),0)+1 FROM payload_migrations
      HAVING NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name=${name})`)
  })
  console.log(`${name} applied and recorded. Existing lead and subscription records were not changed.`)
} finally {
  await payload.destroy()
}
