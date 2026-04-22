/**
 * convert-icons.js
 * Converts SVG icons to PNG using sharp (if installed).
 * Run: npm install sharp  →  node scripts/convert-icons.js
 */

const path = require('path');
const fs   = require('fs');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('❌ sharp is not installed. Run: npm install sharp');
    process.exit(1);
  }

  const SIZES = [16, 32, 48, 128];
  const ICONS_DIR = path.join(__dirname, '..', 'icons');

  for (const size of SIZES) {
    const svgPath = path.join(ICONS_DIR, `icon${size}.svg`);
    const pngPath = path.join(ICONS_DIR, `icon${size}.png`);

    if (!fs.existsSync(svgPath)) {
      console.warn(`⚠️ ${svgPath} not found. Run generate-icons.js first.`);
      continue;
    }

    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath);

    console.log(`✅ icon${size}.png (${size}×${size}px)`);
  }

  console.log('\n🎉 All icons converted to PNG!');
}

main().catch(err => { console.error(err); process.exit(1); });
