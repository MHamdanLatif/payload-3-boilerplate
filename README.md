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


## Payment Plan Studio (admin only)

Open **Payment Plan Studio** from the CMS dashboard, or visit `/internal/payment-plans` after signing in. Both the page and `POST /api/admin/payment-plan/pdf` require an authenticated CMS `users` account. Existing CMS users are administrators; this project does not have a separate staff-role system.

1. Select a Featured Project and unit to load the configured payment heads and builder defaults.
2. Set the base price, named extra charges and discounts in PKR.
3. For each charge choose **In regular schedule** or **Separate payment**. A separate parking payment due in month 6 increases the final price once without changing the regular schedule.
4. Edit payment names, amounts, counts and timing. **Enter an amount** preserves that amount; **Calculate for me** allocates the remainder across selected payments. Down payment and possession use PKR amounts in the studio.
5. Review the remaining balance and export the shared branded PDF. Export is blocked for invalid or unbalanced plans. Optional buyer details appear on the PDF.

Drafts are held in the current browser tab only, and are lost on reload or navigation. Switching project/unit asks before replacing the draft. Studio changes do not modify public project prices or builder defaults. Studio exports do not write leads or send advertising/Privyr events. Duration is descriptive; existing payment dates and counts are edited explicitly. Month 0 means signing, or construction completion for an undated milestone.

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

The unit suite covers allocation invariants, rounding, project constraints, Auto DP PDF parity and separate charges. The Docker/PostgreSQL Playwright suite includes the admin-only route, price adjustments, PDF download, public amount choices and stable unit selection alongside onboarding, seeding and comments. It requires Docker and Playwright Chromium (`corepack pnpm exec playwright install chromium`). Test-server environment overrides disable Privyr, Meta CAPI and ntfy delivery.
