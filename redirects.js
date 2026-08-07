const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // ── Legacy URLs from the old static site ──────────────────────────────────
  // Google still has the pre-relaunch URLs indexed under `/featured/*` and the
  // raw `/index.html` file. Permanent (308) redirects forward link-equity from
  // the indexed URLs to the new Next.js routes. Order: specific rules first,
  // catch-all last.
  const legacyRedirects = [
    { source: '/index.html', destination: '/', permanent: true },

    // Live projects — direct equivalents on the new site
    {
      source: '/featured/tulip-comfort',
      destination: '/projects/tulip-comfort',
      permanent: true,
    },
    {
      source: '/featured/saima-elite-enclave',
      destination: '/projects/saima-elite-enclave',
      permanent: true,
    },
    // Saima Center Point is sold out — the FeaturedProject doc was deleted, so
    // /projects/saima-center-point now 404s. Both the old /featured URL and the
    // (still-ranking) /projects URL forward to the home-page Featured Projects
    // grid so search traffic lands on live inventory instead of a dead page.
    // Pointed straight at the final destination — no /featured -> /projects hop.
    {
      source: '/featured/saima-center-point',
      destination: '/#listings',
      permanent: true,
    },
    {
      source: '/projects/saima-center-point',
      destination: '/#listings',
      permanent: true,
    },
    // Lateef Duplex Luxuria is a listing (not a project page) — point the old
    // /featured URL at its listing rather than the generic /properties catch-all.
    {
      source: '/featured/lateef-duplex-luxuria',
      destination: '/listings/4-bed-duplex-apartment-in-lateef-duplex-luxuria-scheme-33',
      permanent: true,
    },

    // Retired project — no destination project page, send buyers to the listings
    { source: '/featured/saima-uptown', destination: '/properties', permanent: true },

    // Placeholder: /saima-uptown has no page yet. TEMPORARY (307) redirect to
    // /properties until Saima Uptown is added as a listing — then repoint this
    // to /listings/<slug> (keep it temporary, or drop it once the page exists).
    { source: '/saima-uptown', destination: '/properties', permanent: false },

    // Anything else the old site exposed under /featured/* — funnel to listings
    { source: '/featured/:slug*', destination: '/properties', permanent: true },

    // Spelling: Gulistan-e-Jauhar → Gulistan-e-Johar. People search "johar",
    // not "jauhar"; the location entity slug was renamed in code and the old
    // URL needs to forward so any existing GSC ranking or external link still
    // lands buyers on the correct page.
    {
      source: '/locations/gulistan-e-jauhar',
      destination: '/locations/gulistan-e-johar',
      permanent: true,
    },

    // Blog slug cleanups (site audit). The Tulip post was standardised to the
    // singular project name; the Saima Elite post had a stray double hyphen
    // left over from the "&" in its title. Forward the old slugs.
    {
      source: '/blog/tulip-comforts-pre-launch-apartments-in-scheme-33-karachi',
      destination: '/blog/tulip-comfort-pre-launch-apartments-in-scheme-33-karachi',
      permanent: true,
    },
    {
      source: '/blog/saima-elite-enclave-price-payment-plan--location-guide',
      destination: '/blog/saima-elite-enclave-price-payment-plan-location-guide',
      permanent: true,
    },

    // Slug tidy-ups: stray double hyphens (from " - " / "/" in titles) collapsed
    // to single, and a trailing hyphen trimmed. formatSlug now prevents these.
    {
      source: '/listings/4-bed-flat-in-saim-residency-gulshan-e-iqbal-13-d2--urgent-sale',
      destination: '/listings/4-bed-flat-in-saim-residency-gulshan-e-iqbal-13-d2-urgent-sale',
      permanent: true,
    },
    {
      source: '/listings/3-bed-drawing-lounge-flat-in-rim-jhim-villas-scheme-33--roof-terrace',
      destination: '/listings/3-bed-drawing-lounge-flat-in-rim-jhim-villas-scheme-33-roof-terrace',
      permanent: true,
    },
    {
      source: '/blog/an-opportunity-4-bed-flat-in-gulshan-e-iqbal-',
      destination: '/blog/an-opportunity-4-bed-flat-in-gulshan-e-iqbal',
      permanent: true,
    },

    // Old static blog URLs from the pre-relaunch site (indexed, now 404). The new
    // blog lives at /blog (singular). Flat .html pages and the plural /blogs path
    // forward to the index; deep /blogs/<slug> paths map to /blog/<slug>.
    { source: '/blog.html', destination: '/blog', permanent: true },
    { source: '/blog-post.html', destination: '/blog', permanent: true },
    { source: '/blog-verify-ownership.html', destination: '/blog', permanent: true },
    { source: '/blogs', destination: '/blog', permanent: true },
    { source: '/blogs/:slug*', destination: '/blog/:slug*', permanent: true },
  ]

  // ── Canonicalize host: www → apex ─────────────────────────────────────────
  // Google indexed www.lateefproperties.com; the new site canonicals at the
  // apex. Forward the www host so link-equity consolidates on one canonical.
  // Note: if Search Console is verified on the www property, you may need to
  // re-verify on the apex property after this ships.
  const wwwToApex = {
    source: '/:path*',
    has: [{ type: 'host', value: 'www.lateefproperties.com' }],
    destination: 'https://lateefproperties.com/:path*',
    permanent: true,
  }

  return [internetExplorerRedirect, ...legacyRedirects, wwwToApex]
}

export default redirects
