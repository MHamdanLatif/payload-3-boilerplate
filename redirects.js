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
