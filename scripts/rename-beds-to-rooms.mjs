// One-shot: rename `beds`→`rooms` / `bedrooms`→`rooms` and refresh the unit-type
// enum values from "X Bed Lounge" to "X Room Lounge". Idempotent.
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
  // Rename column on featured_projects_unit_types
  `DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'featured_projects_unit_types' AND column_name = 'beds'
    ) THEN
      ALTER TABLE "featured_projects_unit_types" RENAME COLUMN "beds" TO "rooms";
    END IF;
  END $$;`,

  // Rename column on property_listings
  `DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'property_listings' AND column_name = 'bedrooms'
    ) THEN
      ALTER TABLE "property_listings" RENAME COLUMN "bedrooms" TO "rooms";
    END IF;
  END $$;`,

  // Refresh unit-type enum. ALTER TYPE RENAME VALUE works on Postgres 10+ and
  // doesn't require dropping the type (safe even if no rows exist yet).
  `DO $$ BEGIN
    ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '1 Bed Lounge'  TO '1 Room Lounge';
  EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '2 Bed Lounge'  TO '2 Room Lounge';
  EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '2 Bed Drawing' TO '2 Room Drawing';
  EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '3 Bed Lounge'  TO '3 Room Lounge';
  EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '3 Bed Drawing' TO '3 Room Drawing';
  EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '4 Bed Drawing' TO '4 Room Drawing';
  EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "enum_featured_projects_unit_types_type" RENAME VALUE '4+ Beds'       TO '4+ Rooms';
  EXCEPTION WHEN invalid_parameter_value THEN null; WHEN undefined_object THEN null; END $$;`,
]

await client.connect()
for (const s of stmts) {
  try {
    await client.query(s)
    console.log('ok')
  } catch (e) {
    console.warn('skip:', e.message.slice(0, 120))
  }
}
await client.end()
console.log('done.')
