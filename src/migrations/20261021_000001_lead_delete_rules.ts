import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// 20261012 declared these columns NOT NULL but ON DELETE SET NULL, so deleting a
// lead with a saved schedule (or a staff user who saved a revision) failed with a
// raw constraint error. Schedules now go with their lead; a revision outlives the
// staff account that saved it. Existing constraints are looked up by column, not
// by name, because the inline REFERENCES produced Postgres-generated names.
type Rule = { table: string; column: string; references: string; onDelete: string; name: string }

const replaceForeignKey = ({ table, column, references, onDelete, name }: Rule) => `
  DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT con.conname FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE con.contype = 'f' AND con.conrelid = 'public.${table}'::regclass
        AND con.confrelid = 'public.${references}'::regclass
        AND array_length(con.conkey, 1) = 1 AND a.attname = '${column}'
    LOOP EXECUTE format('ALTER TABLE public.${table} DROP CONSTRAINT %I', r.conname); END LOOP;
    ALTER TABLE public.${table} ADD CONSTRAINT ${name}
      FOREIGN KEY (${column}) REFERENCES public.${references}(id) ON DELETE ${onDelete};
  END $$;`

const rules = (scheduleDelete: string, authorDelete: string): Rule[] => [
  {
    table: 'lead_schedules',
    column: 'lead_id',
    references: 'leads',
    onDelete: scheduleDelete,
    name: 'lead_schedules_lead_id_leads_id_fk',
  },
  {
    table: 'schedule_revisions',
    column: 'schedule_id',
    references: 'lead_schedules',
    onDelete: scheduleDelete,
    name: 'schedule_revisions_schedule_id_lead_schedules_id_fk',
  },
  {
    table: 'schedule_revisions',
    column: 'created_by_id',
    references: 'users',
    onDelete: authorDelete,
    name: 'schedule_revisions_created_by_id_users_id_fk',
  },
]

export const leadDeleteRulesSql = [
  'ALTER TABLE public.schedule_revisions ALTER COLUMN created_by_id DROP NOT NULL;',
  ...rules('CASCADE', 'SET NULL').map(replaceForeignKey),
].join('\n')

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(leadDeleteRulesSql))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revisions saved by since-deleted staff cannot satisfy NOT NULL again; refuse
  // rather than invent an author.
  await db.execute(
    sql.raw(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM public.schedule_revisions WHERE created_by_id IS NULL) THEN
        RAISE EXCEPTION 'Some schedule revisions have no author (staff account deleted). Restore a reviewed backup to roll back.';
      END IF;
    END $$;
    ${rules('SET NULL', 'SET NULL').map(replaceForeignKey).join('\n')}
    ALTER TABLE public.schedule_revisions ALTER COLUMN created_by_id SET NOT NULL;
  `),
  )
}
