import assert from 'node:assert/strict'
import { sql } from '@payloadcms/db-postgres'
import { up, down } from '../../src/migrations/20261111_000000_finance_projects'

/** Exercise the upgrade against an isolated old-schema fixture in a local test database. */
export async function verifyFinanceProjectMigration(drizzle: any) {
  await drizzle.transaction(async (db: any) => {
    const schema = `finance_migration_${Date.now()}`
    await db.execute(sql.raw(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};`))
    await db.execute(sql.raw(`
      CREATE TABLE featured_projects (id integer PRIMARY KEY, title varchar NOT NULL);
      CREATE TABLE marketed_projects (id integer PRIMARY KEY, title varchar NOT NULL, linked_project_id integer);
      CREATE TABLE payload_locked_documents_rels (id integer PRIMARY KEY);
      INSERT INTO featured_projects VALUES (7, 'Existing organic'), (11, 'Second organic');
      INSERT INTO marketed_projects VALUES (7, 'Paid only', NULL), (8, 'Linked page', 7);
    `))
    for (const table of ['finance_project_rules', 'finance_campaigns', 'finance_funding', 'finance_ad_charges_lines', 'finance_ad_charges_shares']) {
      await db.execute(sql.raw(`CREATE TABLE ${table} (id integer PRIMARY KEY, project_id integer,
        CONSTRAINT ${table}_project_id_featured_projects_id_fk FOREIGN KEY (project_id) REFERENCES featured_projects(id));
        INSERT INTO ${table} VALUES (1,7);`))
    }
    await up({ db } as never)
    await up({ db } as never)
    const projects = (await db.execute(sql`SELECT * FROM finance_projects ORDER BY id`)).rows
    assert.equal(projects.length, 3, 'rerunning does not duplicate projects or add linked marketing pages')
    assert.equal(projects[0].id, 7)
    assert.equal(projects[0].featured_project_id, 7)
    const paid = projects.find((p: any) => p.marketed_project_id === 7)
    assert.ok(paid.id > 11, 'source IDs may collide without colliding in Finance')
    await db.execute(sql`INSERT INTO finance_funding VALUES (2, ${paid.id})`)
    await db.execute(sql`DELETE FROM marketed_projects WHERE id=7`)
    const retained = (await db.execute(sql`SELECT p.title, p.marketed_project_id FROM finance_funding f JOIN finance_projects p ON p.id=f.project_id WHERE f.id=2`)).rows[0]
    assert.equal(retained.title, 'Paid only')
    assert.equal(retained.marketed_project_id, null)
    assert.equal((await db.execute(sql`SELECT project_id FROM finance_ad_charges_shares WHERE id=1`)).rows[0].project_id, 7)
    await assert.rejects(() => down({ db } as never), /financial history/)
    await db.execute(sql.raw(`DROP SCHEMA ${schema} CASCADE`))
  })
}
