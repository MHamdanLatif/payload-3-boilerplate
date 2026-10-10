import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import edits from './data/project-marketing-blog-edits.json'
import { projectMarketingArticle as article } from './data/project-marketing-article'

type Node = { text?: string; type?: string; fields?: { url?: string }; children?: Node[]; [key: string]: unknown }

export function updateArticle(root: Node, plan: (typeof edits)[number]): Node {
  const copy = structuredClone(root)
  function visit(node: Node) {
    if (typeof node.text === 'string') {
      const edit = plan.replacements.find(change => change.before === node.text)
      if (edit) node.text = edit.after
    }
    if (node.children) {
      node.children = node.children.flatMap(child => {
        visit(child)
        return plan.unlinkListings && child.type === 'link' && /(?:^|\/)listings\//.test(child.fields?.url || '')
          ? child.children || [] : [child]
      })
    }
  }
  visit(copy)
  return copy
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  for (const plan of edits) {
    const result = await db.execute(sql`SELECT id, content FROM blogs WHERE slug = ${plan.slug}`)
    const blog = result.rows[0] as { id: number; content: { root: Node } } | undefined
    if (!blog) continue // Fresh installations do not contain the production articles.
    if (plan.retire) {
      await db.execute(sql`UPDATE blogs SET status = 'draft', updated_at = NOW() WHERE id = ${blog.id}`)
      continue
    }
    const content = { ...blog.content, root: updateArticle(blog.content.root, plan) }
    if (JSON.stringify(content) !== JSON.stringify(blog.content)) {
      await db.execute(sql`UPDATE blogs SET content = ${JSON.stringify(content)}::jsonb, updated_at = NOW() WHERE id = ${blog.id}`)
    }
  }
  const existing = await db.execute(sql`SELECT id FROM blogs WHERE slug = ${article.slug}`)
  if (!existing.rows.length) {
    await db.execute(sql`INSERT INTO blogs (title, slug, status, excerpt, meta_title, meta_description, content, read_time, created_at, updated_at)
      VALUES (${article.title}, ${article.slug}, 'draft', ${article.excerpt}, ${article.metaTitle}, ${article.metaDescription}, ${JSON.stringify(article.content)}::jsonb, 5, NOW(), NOW())`)
  }
  payload.logger.info('Project marketing content updated; new buyer guide remains a draft. See docs/project-marketing-blog-audit.json.')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Editorial updates must not automatically republish a retired resale ad or
  // overwrite subsequent edits. Restore specific content from a backup if needed.
  payload.logger.info('Editorial content retained; no automatic content rollback.')
}
