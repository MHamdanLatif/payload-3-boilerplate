import sharp from 'sharp'

const BRAND_DEEP = { r: 47, g: 53, b: 88, alpha: 1 } // #2f3558
const TILE = 500
const LOGO_MAX = 380

async function build() {
  const logo = await sharp('public/brand/lateef-logo.png')
    .resize(LOGO_MAX, LOGO_MAX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  const tile = await sharp({
    create: { width: TILE, height: TILE, channels: 4, background: BRAND_DEEP },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer()

  await sharp(tile).resize(32, 32).png().toFile('src/app/icon.png')
  await sharp(tile).resize(180, 180).png().toFile('src/app/apple-icon.png')
  await sharp(tile).resize(192, 192).png().toFile('public/icon-192.png')
  await sharp(tile).resize(512, 512).png().toFile('public/icon-512.png')

  console.log('ok — generated:')
  console.log('  src/app/icon.png (32x32)')
  console.log('  src/app/apple-icon.png (180x180)')
  console.log('  public/icon-192.png')
  console.log('  public/icon-512.png')
}

build().catch((e) => { console.error(e); process.exit(1) })
