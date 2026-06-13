# Blog Workflow — manual content, automated SEO

Every blog post is hand-written by you in your Claude Max conversation, with the
cover image generated in Gemini Pro, then pasted into the CMS. The CMS handles
SEO and internal linking automatically.

No API keys required.

---

## 1. Write the article (in Claude Max)

Open a Claude conversation. Paste this as your starting instruction (the brand
voice rules + structural targets are non-negotiable; keep them in every chat):

> You are a Karachi-based real-estate content writer for Lateef Properties — a
> modern marketing agency. Write a 1000–1500 word article on the topic below.
>
> **Strict rules — violations make the article unusable:**
> - NEVER use these words: `1962`, `decades`, `legacy`, `heritage`,
>   `three generations`, `stewardship`, `shaped Karachi's skyline`
> - NEVER reference `Lateef Builders` (separate parent company)
> - NEVER use absolute claims: `100% verified`, `guaranteed`,
>   `every property is independently vetted`, `zero risk`
> - NEVER use AI clichés: `in today's fast-paced world`,
>   `navigate the complex landscape`, `unlock the potential`,
>   `the world of real estate`, `dive into`
> - NO financing language (we don't do bank financing)
>
> **Tone:** sharp, factual, conversion-led, third-person advisor voice.
> Cite Karachi neighbourhoods, Pakistani buying conventions, PKR pricing.
>
> **Structure (mandatory):**
> - 1000–1500 words of MARKDOWN
> - H2 (`##`) sub-headings every 200–300 words
> - Bullet lists where naturally helpful
> - Open with a 2–3 sentence hook (no "in this article we will cover…")
> - End with a soft CTA: `[Browse our properties](/properties)`
>
> **Keyword placement (mandatory):**
> - The PRIMARY keyword MUST appear EXACTLY in the article title
> - The PRIMARY keyword MUST appear EXACTLY in the first 100 words
> - At LEAST 2 secondary keywords MUST appear as exact-match text in H2
>   headings
>
> **Output format:** plain markdown only. No commentary, no preamble.
>
> ---
>
> TOPIC: <paste from your Content Backlog>
> PRIMARY KEYWORD: <one phrase>
> SECONDARY KEYWORDS: <comma-separated 4–6 phrases>

When Claude finishes, copy the full markdown output.

## 2. Generate the cover image (in Gemini Pro)

Use this prompt template:

> Photoreal editorial photograph for a Karachi real-estate blog article titled
> "[YOUR TITLE]". Subject: [PRIMARY KEYWORD]. Modern, premium architectural
> aesthetic. Soft natural light, shallow depth of field, no text overlays,
> no watermarks, no people. 16:9 aspect ratio. Color palette: warm ivory,
> deep navy-purple, muted gold accents.

Save the image as JPEG or WebP, ~250–400 KB.

## 3. Paste into the CMS

`/admin → Blogs → Create New`

| Field | What to do |
|---|---|
| Title | Paste the article title from Claude. Must include the primary keyword exactly. |
| Slug | Auto-generates from title. Edit if you want a shorter URL. |
| Status | Leave as `draft` for now. |
| Excerpt | **Leave blank** — auto-fills from first ~280 chars of content. Override if you want. |
| Meta Title | Optional. Falls back to `${title} \| Lateef Properties` on the public page. |
| Meta Description | **Leave blank** — auto-fills from first ~160 chars. Override if you want. |
| Keywords | Add 8–12 rows. Use the same keywords from your Claude prompt + any related phrases. |
| Featured Image | Upload the image from step 2. |
| Article Body | Paste the markdown from Claude — `##`, `-`, `**bold**`, `[text](url)` auto-convert. |

Click **Save Draft**.

## 4. Review auto-detected internal links

After save, scroll to the `SEO Internal Links` array on the Blog doc. The CMS
will have populated it by scanning your article for these entities:

- **5 projects:** Saima Elite Enclave, Tulip Comforts, Saima Center Point,
  Saima Uptown, Saima Dreams
- **8 locations:** Gulshan-e-Iqbal, Gulistan-e-Jauhar, Scheme 33, DHA,
  Clifton, Jinnah Avenue, M.A. Jinnah Road, Malir

Aliases match too — "Tulip" / "Tulip Comfort" / "Tulip Comforts" all resolve
to the same project. "MA Jinnah Road" / "M.A Jinnah" both resolve to the
M.A. Jinnah Road silo page.

You can:
- **Drop** any entry that doesn't make sense for this article
- **Add** a custom link manually: anchorText = whatever, linkType = `index`
  (links to home) or `project` (pick a featured project) or `location`
  (enter the slug, e.g. `scheme-33`)

The hook is idempotent — re-saving never duplicates entries already there.

## 5. Publish

Flip `Status` from `Draft` to `Published`, then click Save.

The `injectInternalLinks` hook fires:
- For each link entry not yet `injected`, finds the first un-linked exact
  match of `anchorText` in the article body
- Wraps it in a Lexical Link node pointing to the resolved target URL
- Marks the entry `injected: true`

Re-saving a published post is safe — entries already injected are skipped.

## 6. Verify

1. **Public render** — visit `/blog/<slug>`. Confirm:
   - Hero image visible
   - H2 headings render
   - Bullet lists styled
   - Internal links are clickable and route correctly
2. **JSON-LD** — view-source. Confirm `BlogPosting` + `Article` schema block
   present in the head.
3. **Rich Results Test** — paste the URL into
   https://search.google.com/test/rich-results. Expect zero errors.
4. **Sitemap** — refresh `/sitemap.xml`. Confirm the new blog URL is listed.
5. **Optional** — back in `/admin → Content → Blog Topics`, find the matching
   backlog row, check **Written**, set **Published As** to this new Blog.

---

## What the CMS does automatically (no work required)

- **Slug** generation from title
- **Excerpt** + **Meta Description** auto-derive from content if blank
- **Read time** computed from word count (220 wpm baseline)
- **Published At** stamped at the moment you flip status to published
- **Internal link scan** runs on every save and merges new findings with your
  manual edits
- **Internal link injection** wraps anchor texts in Lexical link nodes on
  publish
- **`BlogPosting` JSON-LD schema** rendered on `/blog/<slug>`
- **Sitemap** auto-includes published blogs
- **OG + Twitter** preview tags auto-populate from title + excerpt + image

## What stays manual (intentional)

- **Brand voice review** — you read the draft before publishing
- **Image choice** — Gemini Pro output, your eye on which fits
- **Keyword strategy** — your choice of primary + secondary keywords
- **Internal link curation** — auto-scanner finds candidates; you decide which to keep

That's the whole flow. Bookmark this doc for future writing sessions.
