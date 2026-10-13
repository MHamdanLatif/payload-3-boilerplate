# Site fonts

Playfair Display (400–700, normal and italic) and Poppins (300–700, normal)
are bundled as Latin WOFF2 fonts and loaded using `next/font/local`.
All four public root layouts share these definitions and CSS variable names.

Downloaded from the Google Fonts CSS API on 2026-10-13:

- https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap
- https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap

The corresponding SIL Open Font Licenses are included alongside the fonts,
from `google/fonts` (`ofl/playfairdisplay/OFL.txt` and `ofl/poppins/OFL.txt`).

Do not replace these with build-time downloads: extensionless Google Fonts
URLs can break Next.js's font loader (vercel/next.js#99114).
