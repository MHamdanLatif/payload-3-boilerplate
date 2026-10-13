import localFont from 'next/font/local'

// Keep builds independent of Google Fonts responses (Next.js issue #99114).
export const playfair = localFont({
  src: [
    { path: './playfair-400-700-normal.woff2', weight: '400 700', style: 'normal' },
    { path: './playfair-400-700-italic.woff2', weight: '400 700', style: 'italic' },
  ],
  variable: '--font-playfair',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
})

export const poppins = localFont({
  src: [
    { path: './poppins-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './poppins-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './poppins-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './poppins-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './poppins-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
})
