// One-shot DB sync for the "Send File" flow. Idempotent.
//   • leads.brochure_opened_at — read-receipt timestamp.
//   • crm_settings global table — editable WhatsApp message template.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const i = line.indexOf('=')
    if (i === -1) return acc
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    acc[k] = v
    return acc
  }, {})

const { Client } = pg
const client = new Client({ connectionString: env.DATABASE_URI })

const stmts = [
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "brochure_opened_at" timestamp(3) with time zone;`,
  `CREATE TABLE IF NOT EXISTS "crm_settings" (
     "id" serial PRIMARY KEY NOT NULL,
     "whatsapp_message_template" varchar DEFAULT 'Hi {name}, here''s the {project} brochure: {link}',
     "updated_at" timestamp(3) with time zone,
     "created_at" timestamp(3) with time zone
   );`,
]

async function main() {
  await client.connect()
  for (const s of stmts) {
    await client.query(s)
    console.log('OK:', s.split('\n')[0].slice(0, 70))
  }
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name='brochure_opened_at';`,
  )
  console.log('leads.brochure_opened_at present:', rows.length === 1)
  const { rows: t } = await client.query(
    `SELECT to_regclass('public.crm_settings') AS tbl;`,
  )
  console.log('crm_settings table:', t[0].tbl)
  await client.end()
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
