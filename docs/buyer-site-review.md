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
- CMS editorial changes were applied to production on 10 October 2026 after the owner’s explicit request and a content backup: 33 articles updated and one buyer guide added as a draft. The owner-deleted Saim article was skipped; existing publication dates and project/listing records were unchanged. Detailed decisions are in the two JSON audit files. The new buyer guide stays a draft. The existing Al Wahab logo is retained because inspected alternatives do not establish a sharper approved logo.

## Retired URLs

The initial review used 404 responses. The owner subsequently requested redirects on 10 October 2026: the following URLs now have explicit **308 permanent redirects to `/properties`**, the current project directory. No unrelated individual project is presented as an equivalent replacement:

- `/listings/4-bed-duplex-apartment-in-lateef-duplex-luxuria-scheme-33`
- `/listings/3-bed-drawing-lounge-flat-in-rim-jhim-villas-scheme-33-roof-terrace`
- `/listings/4-bed-flat-in-saim-residency-gulshan-e-iqbal-13-d2-urgent-sale`
- `/featured/lateef-duplex-luxuria`

The deleted `/blog/an-opportunity-4-bed-flat-in-gulshan-e-iqbal` URL, its trailing-hyphen alias and the old double-hyphen Saim/Rim Jhim listing variants also redirect directly to `/properties` with 308. The migration did not recreate the deleted blog. Other unknown listing URLs retain 404 responses. Valid project/blog spelling redirects are preserved. The educational `/blog/4-bed-duplex-karachi-what-around-3-crore-actually-buys` remains unchanged in URL and scope.

## Validation

- Production build and TypeScript validation passed.
- Full lint was run: 13 existing React-hook errors remain. Comparing the affected files with HEAD confirms the same baseline errors; the calculator errors only shift by one line due to an import. No unrelated lint rules were suppressed or finance/CRM code changed.
- Five focused unit tests passed: exact price boundaries, same-unit matching, public project query/Ready compatibility, Karachi/date-only dates, and non-destructive editorial edits.
- Standard Docker-started e2e attempt was blocked because Docker is absent. The **same `corepack pnpm test:e2e` suite passed (2 tests)** against a production build and disposable native PostgreSQL `buyer_review_e2e` database on port 3100. Docker workflow files are unchanged. Tests cover onboarding/seeding/comments, payments, CRM, finance, ready eligibility, withdrawn/private inventory, sitemap, optional consultation fields and saved project IDs.
- Editorial migration tested on all 46 audited CMS articles inside a rolled-back local transaction: retained educational duplex article, retired Saim ad, draft buyer guide, unchanged dates and idempotent repeat execution.
- Desktop/mobile browser review at 1440, 768, 414, 390, 375 and 320px: document width equals viewport width. Menu and enquiry modal inspected; homepage screenshots captured at 1440 and 390px. Forms were intercepted with mock responses; external tracking blocked. No production test leads or notifications were sent.
- Mocked browser results confirm optional fields, project source name/slug and matching Pixel event IDs. Initial retired-route 404 checks were superseded by the owner-requested redirect checks below.
- A temporary DNS failure reaching the remote CMS interrupted one dev-server read-only check; the query recovered. Production-build checks used local PostgreSQL and passed.

Review screenshots: `tmp/buyer-review/homepage-desktop.png`, `tmp/buyer-review/homepage-mobile.png`; detailed mobile viewport screenshots and browser results are in the same local directory. Temporary artifacts/settings are excluded from the commit.

## Follow-up database application and redirects

A timestamped pre-change content backup is retained locally at `tmp/project-marketing/content-backup-20261010-175404.json`; read-back verification is in `tmp/project-marketing/production-apply-verification.json`. No finance tables were involved. The migration runner now accepts the explicit `APPLY_PROJECT_MARKETING=true` flag because Payload consumes extra CLI flags. The first invocation stopped at that guard before any writes. Eight exact retired URL variants are covered by redirect assertions in the existing end-to-end suite.

Follow-up validation: production build passed, five focused unit tests passed, and `corepack pnpm test:e2e` passed both tests (1.2 minutes), including all eight HTTP 308 redirects. The first attempt encountered leftover local test records; clearing only the disposable localhost database resolved both failures. Production data was not used for browser tests.
