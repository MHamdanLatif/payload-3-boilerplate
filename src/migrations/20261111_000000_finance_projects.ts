import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS finance_projects (
      id serial PRIMARY KEY,
      title varchar NOT NULL,
      source_key varchar NOT NULL,
      featured_project_id integer CONSTRAINT finance_projects_featured_project_id_featured_projects_id_fk REFERENCES featured_projects(id) ON DELETE SET NULL,
      marketed_project_id integer CONSTRAINT finance_projects_marketed_project_id_marketed_projects_id_fk REFERENCES marketed_projects(id) ON DELETE SET NULL,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS finance_projects_source_key_idx ON finance_projects(source_key);
    CREATE UNIQUE INDEX IF NOT EXISTS finance_projects_featured_project_idx ON finance_projects(featured_project_id);
    CREATE UNIQUE INDEX IF NOT EXISTS finance_projects_marketed_project_idx ON finance_projects(marketed_project_id);
    CREATE INDEX IF NOT EXISTS finance_projects_updated_at_idx ON finance_projects(updated_at);
    CREATE INDEX IF NOT EXISTS finance_projects_created_at_idx ON finance_projects(created_at);
    -- Preserve every existing advertising project ID, URL and financial association.
    INSERT INTO finance_projects (id, title, source_key, featured_project_id)
      SELECT id, title, 'featured:' || id, id FROM featured_projects
      WHERE NOT EXISTS (SELECT 1 FROM finance_projects f WHERE f.source_key='featured:' || featured_projects.id);
    SELECT setval(pg_get_serial_sequence('finance_projects','id'), COALESCE((SELECT MAX(id) FROM finance_projects), 1), EXISTS(SELECT 1 FROM finance_projects));
    INSERT INTO finance_projects (title, source_key, marketed_project_id)
      SELECT title, 'marketed:' || id, id FROM marketed_projects WHERE linked_project_id IS NULL
      ON CONFLICT (source_key) DO NOTHING;
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS finance_projects_id integer;
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_finance_projects_id_idx ON payload_locked_documents_rels(finance_projects_id);
    DO $$ BEGIN
      ALTER TABLE payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_finance_projects_fk
        FOREIGN KEY (finance_projects_id) REFERENCES finance_projects(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `))
  for (const table of ['finance_project_rules', 'finance_campaigns', 'finance_funding', 'finance_ad_charges_lines', 'finance_ad_charges_shares']) {
    await db.execute(sql.raw(`
      ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_project_id_featured_projects_id_fk;
      DO $$ BEGIN
        ALTER TABLE ${table} ADD CONSTRAINT ${table}_project_id_finance_projects_id_fk
          FOREIGN KEY (project_id) REFERENCES finance_projects(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `))
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Finance project identities can own marketed-only financial history. Restore a backup instead of dropping them.')
}
