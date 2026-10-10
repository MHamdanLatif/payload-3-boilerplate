# Buyer website review — 10 October 2026

The existing design is retained with approved buyer copy, shared budget ranges, project-only discovery and targeted mobile corrections. Finance code/data is unchanged.

## Sources and changes

- Homepage copy is component-driven (`src/app/(frontend)/page.tsx`, landing components), with inventory and article records from Payload. Search, form project names and footer categories derive from eligible projects rather than a competing hardcoded inventory list.
- `Header` / `Footer`: buyer navigation, discreet existing Lateef Builders destination, only populated project-category links; frosted header remains readable and mobile menu starts below the desktop navigation breakpoint.
- `HomeSearch`, `SearchFilter`, `property-search`, `project-budgets`: non-overlapping total-price bands; same-unit configuration/layout/price matching; legacy query compatibility; readable, data-driven types/locations; clear/reset empty state.
- `ConsultationForm`: required name/phone, optional budget/location/project/notes; project IDs supplied by CMS options resolve through the existing slug-based lead hook to acquired/current project relationships. Existing lead endpoint, attribution and notification infrastructure is unchanged. Returned event ID is used for Pixel/CAPI deduplication.
- `FeaturedProjectCard`: balanced two-card grid, complete sentence descriptions, all unit types, Starting Price label, aligned View Project / Request Details actions; unsubstantiated Hot Selling badge suppressed. Legitimate builder names remain.
- Listing read access/query exclusions retain records, historical enquiries and CMS relationships. Public listing cards and structured data are removed.
- Homepage metadata matches approved title/description across standard/OG/Twitter, preserves canonical/social image. Meta-keywords tags removed while editorial topic fields remain available for related content.
- About/services/contact have visible server-rendered content even without scroll animations. The detached About card and global horizontal clipping are removed. Anchors clear the sticky header; enquiry modal scrolls within the mobile viewport.
- Privacy/terms and relevant location claims reflect buyer project enquiries. No unrelated legal/financial claims were rewritten.
- CMS editorial changes are prepared as migrations, not written to the production database in this review. Detailed decisions are in the two JSON audit files. The new buyer guide stays a draft. The existing Al Wahab logo is retained because inspected alternatives do not establish a sharper approved logo.

## Retired URLs

No equivalent replacement exists for these standalone units. Each returns **404**, with project-navigation options; no generic replacement redirect:

- `/listings/4-bed-duplex-apartment-in-lateef-duplex-luxuria-scheme-33`
- `/listings/3-bed-drawing-lounge-flat-in-rim-jhim-villas-scheme-33-roof-terrace`
- `/listings/4-bed-flat-in-saim-residency-gulshan-e-iqbal-13-d2-urgent-sale`
- `/featured/lateef-duplex-luxuria`

Old double-hyphen listing variants also return 404 directly. The curated CMS migration retires `/blog/an-opportunity-4-bed-flat-in-gulshan-e-iqbal` to draft; its URL returns 404 after that migration. Its old trailing-hyphen alias no longer redirects. Valid project/blog spelling redirects are preserved. The educational `/blog/4-bed-duplex-karachi-what-around-3-crore-actually-buys` remains unchanged in URL and scope.

## Validation

- Production build and TypeScript validation passed.
- Full lint was run: 13 existing React-hook errors remain. Comparing the affected files with HEAD confirms the same baseline errors; the calculator errors only shift by one line due to an import. No unrelated lint rules were suppressed or finance/CRM code changed.
- Five focused unit tests passed: exact price boundaries, same-unit matching, public project query/Ready compatibility, Karachi/date-only dates, and non-destructive editorial edits.
- Standard Docker-started e2e attempt was blocked because Docker is absent. The **same `corepack pnpm test:e2e` suite passed (2 tests)** against a production build and disposable native PostgreSQL `buyer_review_e2e` database on port 3100. Docker workflow files are unchanged. Tests cover onboarding/seeding/comments, payments, CRM, finance, ready eligibility, withdrawn/private inventory, sitemap, optional consultation fields and saved project IDs.
- Editorial migration tested on all 46 audited CMS articles inside a rolled-back local transaction: retained educational duplex article, retired Saim ad, draft buyer guide, unchanged dates and idempotent repeat execution.
- Desktop/mobile browser review at 1440, 768, 414, 390, 375 and 320px: document width equals viewport width. Menu and enquiry modal inspected; homepage screenshots captured at 1440 and 390px. Forms were intercepted with mock responses; external tracking blocked. No production test leads or notifications were sent.
- Mocked browser results confirm optional fields, project source name/slug and matching Pixel event IDs. Exact retired listing/legacy URL HTTP 404 responses verified against the isolated production build.
- A temporary DNS failure reaching the remote CMS interrupted one dev-server read-only check; the query recovered. Production-build checks used local PostgreSQL and passed.

Review screenshots: `tmp/buyer-review/homepage-desktop.png`, `tmp/buyer-review/homepage-mobile.png`; detailed mobile viewport screenshots and browser results are in the same local directory. Temporary artifacts/settings are excluded from the commit.
