#!/usr/bin/env node
/**
 * Generate manager PWA icons from public/images/logo.png
 *
 * Usage: node scripts/generate-manager-pwa-icons.cjs
 */
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const root = path.join(__dirname, '..')
const logoPath = path.join(root, 'public/images/logo.png')
const outDir = path.join(root, 'public/manager/icons')
const bg = { r: 253, g: 251, b: 247, alpha: 1 } // #fdfbf7

async function make(size, filename, padRatio) {
  const padding = Math.round(size * padRatio)
  const inner = size - padding * 2
  const logo = await sharp(logoPath)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(outDir, filename))

  console.log('✓', filename)
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    console.error('Missing logo at', logoPath)
    process.exit(1)
  }
  fs.mkdirSync(outDir, { recursive: true })
  await make(192, 'icon-192.png', 0.14)
  await make(512, 'icon-512.png', 0.14)
  await make(512, 'icon-512-maskable.png', 0.22)
  await make(180, 'apple-touch-icon.png', 0.14)
  console.log('Manager PWA icons written to public/manager/icons/')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
