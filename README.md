<p align="center">
  <a href="https://funkyton.com/payload-cms/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/hczpmiapo/image/upload/v1732576652/Static%20assets/Logos/payload_V3_mhv6wc.png">
      <source media="(prefers-color-scheme: light)" srcset="https://res.cloudinary.com/hczpmiapo/image/upload/v1732576652/Static%20assets/Logos/payload_V3_mhv6wc.png">
      <img alt="Payload CMS logo" src="https://res.cloudinary.com/hczpmiapo/image/upload/v1732576652/Static%20assets/Logos/payload_V3_mhv6wc.png" width=100>
    </picture>
  </a>
  <a href="https://railway.app/template/L8TUlT?referralCode=-Yg50p">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://railway.app/brand/logo-light.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://railway.app/brand/logo-dark.svg">
      <img alt="Railway logo" src="https://railway.app/brand/logo-light.svg" width=100>
    </picture>
  </a>
</p>

<h2 align="center">
  Payload CMS V3 Website Template<br>
  <a href="https://railway.app/deploy/L8TUlT?referralCode=-Yg50p">One-click deploy on Railway!</a>
</h2>

<h1 align="center">
  Need help?<br>
  <a href="https://funkyton.com/payload-cms/">Step by step guide and instructions</a>
</h1>

<p align="center">
  A powerful, flexible, and production-ready Payload CMS V3 website builder with PostgreSQL database.
</p>

<p align="center">
  <a href="https://github.com/payloadcms/payload/blob/main/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
  <a href="https://discord.gg/payload">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
</p>

## About this boilerplate

This boilerplate is a pre-configured, ready-to-deploy solution for Payload CMS as a website builder. It includes a fully-working backend, enterprise-grade admin panel, and a beautifully designed, production-ready website. This template is optimized for seamless deployment on [Railway](https://railway.app?referralCode=-Yg50p), and uses PostgreSQL for both local development and production environments.

## Version Info

- **Payload CMS**: `3.82.1`
- **Next.js**: `16.2.3`
- **Node.js**: `^18.20.2 || >=20.9.0`

## Preconfigured Features & Integrations

- **Authentication**: Robust user authentication system
- **Access Control**: Role-based access control for admins and users
- **Premium Content**: Gated content for authenticated users
- **Comments**: User commenting system with admin approval
- **Layout Builder**: Flexible content creation with pre-configured blocks
- **Draft Preview**: Preview unpublished content before going live
- **SEO**: Built-in SEO optimization tools
- **Redirects**: Easy management of URL redirects
- **PostgreSQL Support**: Configured for both local and production use

### Railway Setup

Use one-click deploy template:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/L8TUlT?referralCode=-Yg50p)

### Local Setup

1. Clone proejct: (recommeded) Laucnh on Railway and ejct [watch how](https://www.youtube.com/watch?v=LJFek8JP8TE). Alternatively clone this repo or fork it.
2. Copy `.env.example` to `.env` (fill in your own values..)
3. Start PostgreSQL: `docker compose up -d postgres`
4. Install dependencies: `pnpm install` or `npm install`
5. Run development mode: `pnpm dev` or `npm run dev`
or
6. Build the project: `pnpm build` or `npm run build`
7. Start the server: `pnpm start` or `npm run start`

### End-to-End Testing

The Playwright suite boots a fresh PostgreSQL container, builds the app from scratch, creates the first admin user through the onboarding UI, seeds the demo content, submits a public comment, approves it in the admin UI, and verifies it appears on the public post page.

Before the first run, make sure Docker Desktop is running. The suite starts a fresh PostgreSQL container automatically.
For test determinism, the e2e harness uses bundled local seed images only during the test run. Normal seeding continues to use the hosted seed images.

1. Install everything required for e2e: `corepack pnpm e2e:install`
2. Run the suite headlessly: `corepack pnpm test:e2e`
3. Run the suite with a visible browser: `corepack pnpm test:e2e:headed`
4. Run the suite slowly and keep the browser open for manual review: `corepack pnpm test:e2e:manual`

What `e2e:install` does:

- Installs project dependencies
- Rebuilds native dependencies used by the app on Windows, including `sharp` and `esbuild`
- Downloads the Chromium browser used by Playwright

If you prefer `npm`, you can run:

1. `npm run e2e:install`
2. `npm run test:e2e`
3. `npm run test:e2e:headed`
4. `npm run test:e2e:manual`

`test:e2e:manual` runs the suite in headed mode with a visible slowdown between actions and pauses only at the end of the happy path. While paused, the browser stays open so you can click around and manually inspect seeded content, the admin area, and public pages. When you are done, resume or stop the Playwright session from the inspector/terminal.


### Requirements

- **Database**: PostgreSQL
- **Node.js**: Compatible version as specified in `package.json`

### CRM notifications and reporting

New-lead CRM app notifications offer **Send brochure** and **WhatsApp** actions when the lead has the required details. WhatsApp opens a blank chat and marks Uncontacted, Details Sent, or Engaged leads as Contacted; later stages and terminal outcomes stay unchanged. Opening chat does not confirm a message was sent or answered, and does not record a brochure send. Both notification actions use signed links without requiring an admin login.

The leads dashboard, activity timestamps, CSV timestamps, and date filters use Pakistan time (PKT, UTC+5). The e2e suite checks CRM chat actions and timezone rendering with owner notifications and CAPI disabled.

## Useful Resources

- **Blog post about this template**: [Read here](https://funkyton.com/payload-cms/)
- **Official Payload Documentation**: [Read here](https://payloadcms.com/docs)

<p align="center">
  <a href="https://funkyton.com/">
    A template by,
    <br><br>
    <picture>
      <img alt="FUNKYTON logo" src="https://res-5.cloudinary.com/hczpmiapo/image/upload/q_auto/v1/ghost-blog-images/funkyton-logo.png" width=200>
    </picture>
  </a>
</p>


## Marketed project amenities

Marketed projects use a simple **Available Units** list with **Name**, **Type**, and **Area (sq ft)**. Type is the public configuration label (include `(Duplex)` when applicable); Name is an optional internal unit label. Rows drive the hero availability line and enquiry dropdown in CMS order. Detailed unit pricing and payment-plan inputs are only available on organic Featured Projects.

Before deploying this simplification, apply `20260926_000001_marketed_available_units`. It copies existing marketed units into the simple list, preserving names, duplex labels, areas, and the previous hero order. Legacy pricing/payment-plan data is retained in the database but no longer exposed by the marketed-project CMS. Apply the migration against the intended database before building; Railway does not run it automatically.

In **Marketing > Marketed Projects**, add amenities to show the same amenities section used on organic project pages. The marketed page order is hero, gallery, amenities, location, builder, registration CTA, footer. Empty amenities are hidden; content is managed independently from the organic project.

Before deploying, apply `20260926_000000_marketed_project_amenities` using `corepack pnpm payload migrate` against the intended database with its migration history reconciled. Railway does not automatically run migrations. Review pending migrations first; do not run a historical initial migration over an existing untracked schema. This migration adds the amenities table and leaves existing project content unchanged.

## CRM conversation notes and follow-up reminders

### Mobile CRM (Android)

The **Brochures** tab lists leads whose personal brochure links were opened in the past seven days, newest activity first. Each card shows the open count, recorded foreground reading time, last-opened time in PKT, and a **Repeat viewer** badge for multiple opens within that window. Expand **Visit durations** for individual visits or tap the name to open the lead. Missing durations are labeled as not captured; shared links are attributed to their owning lead.

Open `/leads-dashboard` for the mobile-first CRM. In Chrome on Samsung, sign in with your existing CMS account and tap **Install app** (or use Chrome's **Add to Home screen > Install app**). The installed **Lateef CRM** opens directly to your leads. It uses the existing backend and database, with no separate app server or store account. The CRM has its own layout without the public website navigation or marketing trackers.

**Add lead** asks only for name, phone, project, and WhatsApp/Call/Referral. Phone numbers are normalized with Pakistan as the default country. The server fills the project name/slug, acquisition relationships, manual conversion surface, and brochure assets via the existing lead hooks. Calls retain `source=call` and use the existing `manual` acquisition category; WhatsApp and referrals use their matching categories. The mobile lead forms use the existing lead schema; app notifications require the migration below.

Open a lead to change its status using the pinned control, edit contact details/current interest/closed project, call or open WhatsApp, prepare a brochure, and keep notes and reminders. The original acquisition project is preserved when current interest changes. Search and project/status/source filters are on the lead list; existing reporting and CSV export remain under **Reports**. New CRM app lead and brochure-open links go directly to the mobile lead record.

CMS login sessions now last up to 30 days, including admin sessions. The CRM refreshes valid sessions while in use; expired sessions require sign-in. Sign out on shared devices. The scoped service worker does not cache lead data or API responses; viewing and saving records requires internet access. The installed CRM receives Web Push notifications directly. Open **Notifications > Enable notifications**, allow Chrome/Android permission, then use **Send test**. Each device opts in separately; **Disable** and **Sign out** remove its subscription. New-lead notifications include **Send brochure** (when a brochure and phone are available) and **WhatsApp** actions. Expand the Android notification to see its buttons. Browser/OS delivery depends on connectivity and notification settings; a push-service receipt does not prove the phone displayed it.

Apply migrations `20260928_000000_crm_push` and `20260928_000001_lead_notification_queue` before deploying. VAPID keys are generated once in the private `crm_push_settings` database record; subscriptions are stored in the private `push_subscriptions` collection. Both deny public/admin API access; the authenticated CRM endpoint exposes only the public key. Back up this database record with the database: losing the key pair requires devices to enable notifications again. No additional push provider account or subscription is needed. Existing NTFY environment variables are unused and may be removed. Set `CRM_PUSH_DISABLED=true` to suppress notifications in tests/local environments.

New-lead alerts now use a PostgreSQL queue reconciled from committed leads every 30 seconds, rather than a detached save hook. Unique event keys and leased claims survive restarts and coordinate replicas. The worker confirms display through a signed receipt after the service worker successfully calls `showNotification`. This confirms app display, not human reading or audibility. Devices without a receipt retry every five minutes for up to 24 hours; confirmed devices are excluded. Each event has a stable notification tag, so retries replace the same alert instead of stacking duplicates. Queued pushes have a five-minute TTL to limit stale delivery. Keep the Railway service running; Android notification permissions and battery restrictions still affect delivery.

**Automatic Uncontacted reminders** are enabled by default and can be toggled in the CRM's Notifications panel or CMS CRM Settings. New leads get a reminder at 30 minutes and another at 2 hours from creation, only if their current status is still Uncontacted (stored as `unqualified`). The migration records a durable cutoff; pre-existing leads are excluded. These do not overwrite manually scheduled follow-ups. If the server resumes after both deadlines, only the two-hour reminder sends. Status is checked again before each delivery attempt; already in-flight notifications cannot be recalled. Expired or cancelled events remain recorded for diagnosis.

Checks: `corepack pnpm exec node --test tests/unit/crm.test.mjs tests/unit/crm-push.test.mjs` and `corepack pnpm test:e2e`. The e2e suite includes 360px manual entry, status/contact/closed-project edits, generated attribution, search, manifest, and overflow checks.

For SQL-level queue verification, set `CRM_QUEUE_TEST_DATABASE_URI` and run `node tests/integration/lead-notifications.mjs`. It uses temporary tables inside a rolled-back transaction and mocks push delivery.

Brochure-page opens and reopens send a CRM app alert on every recorded visit, with no cooldown. The former `BROCHURE_REOPEN_COOLDOWN_MINUTES` and `BROCHURE_REOPEN_COOLDOWN_HOURS` environment settings are no longer used.

Open a lead from `/leads-dashboard` to keep conversation pointers in **Conversation notes** and choose **Set a reminder**. New and existing leads start with **No reminder**. Select a future date/time and save; choose **No reminder** and save to cancel. The dashboard uses Pakistan time (PKT, UTC+5); the CMS admin date picker uses the browser timezone. The same fields are editable in **CRM → Leads**. Original enquiry notes are kept separately.

Reminders use the CRM devices that have enabled notifications. With no subscribed devices, reminders remain pending and retry. Set `NEXT_PUBLIC_SERVER_URL` to the public site URL for notification links. The running Next.js server checks Postgres every 30 seconds, including immediately on startup. No browser needs to stay open. Keep the Railway service running (disable sleeping/serverless suspension); reminders overdue during downtime are delivered when it restarts. This timer requires a long-running Node server, not a request-only serverless deployment. Failed deliveries retry after five minutes; the lead records Pending, Sent or the last delivery error. Database leases coordinate replicas. A crash after the push service accepts a notification but before its receipt is saved can cause a duplicate on retry. Cancellation cannot recall an already in-flight notification.

Before deploying, apply `20260924_000000_lead_follow_up` using `corepack pnpm payload migrate` against the intended database with its existing migration history reconciled. Railway does not automatically run migrations. This adds nullable fields and an index without scheduling existing leads. Review pending migrations before running the command; do not run a historical initial migration over an existing untracked schema.

Verify with `corepack pnpm test:follow-up` and `corepack pnpm test:e2e`. The e2e suite keeps real CRM push delivery disabled; delivery outcomes and rescheduling are covered by isolated unit tests.

## Payment Plan Studio (admin only)

Open **Payment Plan Studio** from the CMS dashboard, or visit `/internal/payment-plans` after signing in. Both the page and `POST /api/admin/payment-plan/pdf` require an authenticated CMS `users` account. Existing CMS users are administrators; this project does not have a separate staff-role system.

1. Select a Featured Project and unit to load the configured payment heads and builder defaults.
2. Set the base price, named extra charges and discounts in PKR.
3. For each charge choose **In regular schedule** or **Separate payment**. A separate parking payment due in month 6 increases the final price once without changing the regular schedule.
4. Edit payment names, amounts, counts and timing. **Enter an amount** preserves that amount; **Calculate for me** allocates the remainder across selected payments. Down payment and possession use PKR amounts in the studio.
5. Review the remaining balance and export the shared branded PDF. Export is blocked for invalid or unbalanced plans. Optional buyer details appear on the PDF.

Drafts are held in the current browser tab only, and are lost on reload or navigation. Switching project/unit asks before replacing the draft. Studio changes do not modify public project prices or builder defaults. Studio exports do not write leads or send advertising events. Duration is descriptive; existing payment dates and counts are edited explicitly. Month 0 means signing, or construction completion for an undated milestone.

The public calculator uses the same plain-language amount choices. Its existing `locked` storage field is retained for compatibility and means an entered amount; there are no lock/unlock controls. Preview and PDF share the selected unit identity, calculation mode and project limits. Calculated payments can differ by a paisa for exact rounding; entered amounts are preserved. With no calculated installment or milestone available, an unallocated balance is reported instead of silently changing down payment.

### Schema change before deployment

Apply migration `20260911_000000_payment_plan_frequency` to an existing database before deploying this change. It adds the `HalfYearly`, `Mixed`, and `None` values to the payment-plan lead frequency enum. It does not rewrite historical records. Railway deployments in this repository do not automatically run migrations; the additive statements for an existing database are:

```sql
ALTER TYPE "enum_payment_plan_leads_installment_frequency" ADD VALUE IF NOT EXISTS 'HalfYearly';
ALTER TYPE "enum_payment_plan_leads_installment_frequency" ADD VALUE IF NOT EXISTS 'Mixed';
ALTER TYPE "enum_payment_plan_leads_installment_frequency" ADD VALUE IF NOT EXISTS 'None';
```

### Verification

Corepack is pinned to pnpm 10.11.0 in `package.json` to keep local commands consistent.

```sh
corepack pnpm test:payment-plan
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm test:e2e
```

The unit suite covers allocation invariants, rounding, project constraints, Auto DP PDF parity and separate charges. The Docker/PostgreSQL Playwright suite includes the admin-only route, price adjustments, PDF download, public amount choices and stable unit selection alongside onboarding, seeding and comments. It requires Docker and Playwright Chromium (`corepack pnpm exec playwright install chromium`). Test-server environment overrides disable Meta CAPI and CRM push delivery.

Website enquiries and payment-plan PDF leads are stored in the native CRM. Privyr forwarding has been removed, including from PDF requests. `PRIVYR_WEBHOOK_URL` is no longer read and can be removed from deployment settings. Existing Privyr history fields are retained but hidden in the admin.

### CRM lead labels and WhatsApp brochures

Lead cards, client records, reports, CSV exports and lead/reminder notifications display the project, acquisition channel (for example Paid - Meta ads or Organic - Google search), and the form or download used. Historical source tags remain stored unchanged. A marketing page alone does not prove paid acquisition: missing attribution displays as Source not recorded, and direct visits remain distinct from organic search. Report source filters group by project, channel and form.

On Android, the mobile CRM brochure button links directly to WhatsApp Business with the prepared message, with a WhatsApp website fallback if the app cannot open. Desktop and iPhone retain the website link. The action is logged through the existing authenticated endpoint; the user still reviews and taps Send in WhatsApp. Chrome controls app-launch confirmation, so a physical Android check is needed to confirm the device-specific experience. Notification brochure actions also use the Android intent when the request identifies Android.

Label, notification and Android-link regression checks: `node --test tests/unit/lead-labels.test.mjs tests/unit/follow-up.test.mjs`. Run `corepack pnpm test:e2e` for the full CRM, onboarding, seeding and comment workflow.

### Private finance management

`/finance` runs inside this Next.js/Payload application, on the existing PostgreSQL database and Railway service. It adds no paid service, hosting instance, subscription, application dependency, or environment variable.

Finance includes Overview, Deals, Receivables, Commission Payments, Expenses, Reports and private CSV exports. Mark a CRM lead Closed Won, then choose **Finance · Record closed deal** to prefill their contact details. Alternatively add a deal directly and enter the client manually. Choose a featured project and unit type (saved configuration, area and editable sale price autofill), or choose **Other property / listing / brokerage** and enter the property and unit type. Enter sale value, optional booking amount, the commission amount and expected receipt date. No client installment, percentage or milestone tracking is required.

**Before deployment:** back up the intended database and apply `20261002_000000_finance` and `20261003_000000_simple_finance` with `corepack pnpm payload migrate`, after reviewing pending migration history. Do not run untracked historical initial migrations over an existing schema. Railway does not automatically apply these migrations. The additive migration must run before starting this version, because the user schema gains permission fields. It grants finance access/administration only to the oldest existing user; verify that this is the intended owner. First-user onboarding grants the first account these permissions on a new installation. The migration is repeatable and its automatic down migration intentionally refuses to drop financial data. Publish to `staging`; a human merges to the production branch.

**Permissions:** `financeAccess` permits finance reads/writes; `financeAdmin` additionally permits granting permissions and managing other users. Other users can update their own profile but cannot grant themselves finance access, edit another user's credentials, create users, or delete users. The existing first-user onboarding endpoint is preserved. Finance pages, server actions, collection REST/GraphQL access and exports enforce authorization on the server. Public page requests go to the existing Payload login; authenticated unauthorized page requests receive not-found, and APIs/exports reject access. Finance responses are private/no-store and noindex. No finance data is added to public CRM/Meta feedback payloads.

**Payments and receivables:** commission is the amount entered on the deal. Outstanding is commission minus non-void receipts, with a minimum of zero. Record the full payment, or enter a partial payment and the next expected date. The entire remaining balance automatically appears in that month's receivables; no separate schedule entry or payment matching is needed. Change the expected date directly from a deal when needed. Dates and overdue detection use Pakistan time. Fully paid and cancelled deals have no receivable; actual cash history is preserved. Overpayments are flagged for review. The dashboard's outstanding balance is all-time; other cards follow the selected closing or payment period.

**Expenses and reports:** expenses can be linked to any deal, including brokerage deals, or recorded as general business expenses such as Meta Ads. Property reports include featured and other properties; general expenses remain separate. Net cash is actual commission received minus expenses paid. Monthly receivables show the unpaid balance by its expected date.

**Existing records:** the simplification migration preserves old tables and history, converts percentage commissions to their existing monetary amount and carries forward an expected date where available. Legacy schedules and trigger fields are hidden from the normal editor. Existing balances without an expected date appear under Needs attention. The four finance collections remain in the schema for compatibility, but new receivables are derived from deals rather than entered into the legacy schedule collection.

**Integrity and audit:** posted amounts and financial relationships are immutable; correct mistakes by voiding with a reason and recording a replacement. Voids cannot be reversed. Finance users can delete erroneous payments or expenses, which recalculates totals. Deleting a deal also deletes its linked receipts, expenses and legacy schedules in the same transaction; a confirmation explains this. Cancel deal stops receivables while retaining cash history. Server-assigned authors, timestamps and unique submission keys preserve attribution and prevent duplicate retries. Receipts must be greater than zero; amounts use at most two decimal places. Updating the next expected date with a receipt uses the same Payload transaction. Finance does not upload attachments into the public media collection.

**Backups:** the four finance tables, their relationships and the two user permission fields are included in a full PostgreSQL database backup. Use the existing database backup/restore workflow and verify its schedule in Railway; this implementation does not enable or assume a paid backup feature. CSV downloads provide independent ledger copies, include voided records and audit columns, and neutralize spreadsheet formula prefixes. CSV files do not replace a transactionally consistent database backup.

**Verification:** `corepack pnpm test:finance` runs focused authorization, input and audit tests. With a disposable localhost database whose name ends in `_e2e`, `corepack pnpm test:finance:db` exercises the migration and calculations in a rolled-back PostgreSQL transaction. `corepack pnpm test:e2e` retains the Docker PostgreSQL flow and checks onboarding, CRM, comments, finance permissions/session expiry, calculations, CSV and quick forms. Its setup initializes the empty local test schema before the production build. When USE_LOCAL_SEED_MEDIA is enabled against a localhost database ending in _e2e, media stays local and S3/R2 uploads are disabled; production storage is unchanged. `corepack pnpm lint` now invokes ESLint directly with `eslint.config.mjs`, as required by Next.js 16. No dependency version changes were needed.
