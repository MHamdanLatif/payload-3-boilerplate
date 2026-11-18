import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE finance_issue_resolutions (
      id serial PRIMARY KEY,
      fingerprint varchar NOT NULL,
      title varchar NOT NULL,
      detail varchar NOT NULL,
      href varchar NOT NULL,
      note varchar NOT NULL,
      resolved_by varchar NOT NULL,
      reopened_at timestamp(3) with time zone,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX finance_issue_resolutions_fingerprint_idx ON finance_issue_resolutions(fingerprint);
    CREATE INDEX finance_issue_resolutions_updated_at_idx ON finance_issue_resolutions(updated_at);
    CREATE INDEX finance_issue_resolutions_created_at_idx ON finance_issue_resolutions(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN finance_issue_resolutions_id integer REFERENCES finance_issue_resolutions(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_finance_issue_resolutions_id_idx ON payload_locked_documents_rels(finance_issue_resolutions_id);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE payload_locked_documents_rels DROP COLUMN finance_issue_resolutions_id;
    DROP TABLE finance_issue_resolutions;
  `)
}
