/**
 * generate-icons.js
 * Node.js script to generate extension icons at all required sizes.
 * Uses Canvas API (via 'canvas' npm package) or falls back to SVG.
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 128];
const ICONS_DIR = path.join(__dirname, '..', 'icons');

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

// Generate SVG icon (scalable, works without canvas)
function generateSVG(size) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const lockW = s * 0.42;
  const lockH = s * 0.35;
  const lockX = cx - lockW / 2;
  const lockY = cy - lockH / 2 + s * 0.04;
  const archR = lockW * 0.35;
  const archStroke = Math.max(2, s * 0.08);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#16162a"/>
      <stop offset="100%" stop-color="#0a0a14"/>
    </radialGradient>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#00FF7F"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${s * 0.06}" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#bg)"/>
  
  <!-- Glow ring -->
  <circle cx="${cx}" cy="${cy}" r="${s * 0.42}" fill="none" stroke="url(#grad)" stroke-width="${s * 0.015}" opacity="0.3"/>
  
  <!-- Lock arch -->
  <path d="M ${cx - archR} ${lockY} 
           A ${archR} ${archR} 0 0 1 ${cx + archR} ${lockY}"
        fill="none" stroke="url(#grad)" stroke-width="${archStroke}" stroke-linecap="round" filter="url(#glow)"/>
  
  <!-- Lock body -->
  <rect x="${lockX}" y="${lockY}" width="${lockW}" height="${lockH}" 
        rx="${s * 0.06}" fill="url(#grad)" opacity="0.9" filter="url(#glow)"/>
  
  <!-- Keyhole -->
  <circle cx="${cx}" cy="${lockY + lockH * 0.42}" r="${s * 0.065}" fill="#0a0a14" opacity="0.8"/>
  <rect x="${cx - s * 0.03}" y="${lockY + lockH * 0.42}" width="${s * 0.06}" height="${s * 0.1}" 
        rx="${s * 0.02}" fill="#0a0a14" opacity="0.8"/>
</svg>`;
}

SIZES.forEach(size => {
  const svg = generateSVG(size);
  const svgPath = path.join(ICONS_DIR, `icon${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`✅ Generated icon${size}.svg`);
});

console.log('\n📝 Note: SVG icons generated. For PNG conversion, install sharp:');
console.log('   npm install sharp');
console.log('   Then run: node scripts/convert-icons.js\n');
console.log('   Or use an online SVG→PNG converter and rename files to .png');
