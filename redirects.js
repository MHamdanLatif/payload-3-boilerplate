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

    // Retired project — no destination project page, send buyers to the listings
    { source: '/featured/saima-uptown', destination: '/properties', permanent: true },

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
