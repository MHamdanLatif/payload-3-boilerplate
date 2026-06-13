// One-shot DB sync for iteration-8 Blogs + BlogTopics collections.
// Idempotent — every statement uses IF (NOT) EXISTS.
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
  // --- Enum: blog status ---
  `DO $$ BEGIN
     CREATE TYPE "enum_blogs_status" AS ENUM ('draft', 'scheduled', 'published');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // --- Main: blogs ---
  `CREATE TABLE IF NOT EXISTS "blogs" (
     "id" serial PRIMARY KEY NOT NULL,
     "title" varchar NOT NULL,
     "slug" varchar,
     "slug_lock" boolean DEFAULT true,
     "status" "enum_blogs_status" NOT NULL DEFAULT 'draft',
     "published_at" timestamp(3) with time zone,
     "read_time" numeric,
     "excerpt" varchar,
     "meta_title" varchar,
     "meta_description" varchar,
     "featured_image_id" integer,
     "content" jsonb,
     "generated_by_topic_id" integer,
     "generated_by_model" varchar,
     "generated_by_generated_at" timestamp(3) with time zone,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `DO $$ BEGIN
     ALTER TABLE "blogs" ADD CONSTRAINT "blogs_featured_image_id_media_id_fk"
       FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id")
       ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "blogs_slug_idx" ON "blogs" USING btree ("slug");`,
  `CREATE INDEX IF NOT EXISTS "blogs_status_idx" ON "blogs" USING btree ("status");`,
  `CREATE INDEX IF NOT EXISTS "blogs_published_at_idx" ON "blogs" USING btree ("published_at");`,
  `CREATE INDEX IF NOT EXISTS "blogs_updated_at_idx" ON "blogs" USING btree ("updated_at");`,

  // --- Blogs keywords array ---
  `CREATE TABLE IF NOT EXISTS "blogs_keywords" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "keyword" varchar NOT NULL
   );`,
  `DO $$ BEGIN
     ALTER TABLE "blogs_keywords" ADD CONSTRAINT "blogs_keywords_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."blogs"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "blogs_keywords_order_idx" ON "blogs_keywords" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "blogs_keywords_parent_id_idx" ON "blogs_keywords" USING btree ("_parent_id");`,

  // --- Main: blog_topics ---
  `CREATE TABLE IF NOT EXISTS "blog_topics" (
     "id" serial PRIMARY KEY NOT NULL,
     "suggested_title" varchar NOT NULL,
     "core_focus" varchar NOT NULL,
     "priority" numeric DEFAULT 100,
     "is_generated" boolean DEFAULT false,
     "generated_blog_id" integer,
     "generation_attempts" numeric DEFAULT 0,
     "last_error" varchar,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `DO $$ BEGIN
     ALTER TABLE "blog_topics" ADD CONSTRAINT "blog_topics_generated_blog_id_fk"
       FOREIGN KEY ("generated_blog_id") REFERENCES "public"."blogs"("id")
       ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "blogs" ADD CONSTRAINT "blogs_generated_by_topic_id_fk"
       FOREIGN KEY ("generated_by_topic_id") REFERENCES "public"."blog_topics"("id")
       ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "blog_topics_is_generated_idx" ON "blog_topics" USING btree ("is_generated");`,
  `CREATE INDEX IF NOT EXISTS "blog_topics_priority_idx" ON "blog_topics" USING btree ("priority");`,

  // --- BlogTopics targetKeywords array ---
  `CREATE TABLE IF NOT EXISTS "blog_topics_target_keywords" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "keyword" varchar NOT NULL
   );`,
  `DO $$ BEGIN
     ALTER TABLE "blog_topics_target_keywords" ADD CONSTRAINT "blog_topics_target_keywords_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "public"."blog_topics"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "blog_topics_target_keywords_order_idx" ON "blog_topics_target_keywords" USING btree ("_order");`,
  `CREATE INDEX IF NOT EXISTS "blog_topics_target_keywords_parent_id_idx" ON "blog_topics_target_keywords" USING btree ("_parent_id");`,

  // --- payload_locked_documents wiring for new collections ---
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "blogs_id" integer;`,
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "blog_topics_id" integer;`,
  `DO $$ BEGIN
     ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blogs_fk"
       FOREIGN KEY ("blogs_id") REFERENCES "public"."blogs"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_topics_fk"
       FOREIGN KEY ("blog_topics_id") REFERENCES "public"."blog_topics"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

await client.connect()
for (const s of stmts) {
  try {
    await client.query(s)
    console.log('ok')
  } catch (e) {
    console.warn('skip:', e.message.slice(0, 200))
  }
}
await client.end()
console.log('done.')
