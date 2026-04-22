/**
 * build.js
 * Cross-browser build script for NoCap extension.
 * Usage: node scripts/build.js [chrome|firefox]
 */

const fs   = require('fs');
const path = require('path');

const target  = process.argv[2] || 'chrome';
const ROOT    = path.join(__dirname, '..');
const DIST    = path.join(ROOT, 'dist', target);

const FILES = [
  'lib/browser-polyfill.js',
  'lib/constants.js',
  'content/content.js',
  'content/content.css',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const CHROME_FILES = [
  ...FILES,
  'background/background.js',
];

const FIREFOX_FILES = [
  ...FILES,
  'background/background-mv2.js',
];

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✅ ${path.relative(ROOT, src)}`);
  } else {
    console.warn(`  ⚠️ Missing: ${path.relative(ROOT, src)}`);
  }
}

function build() {
  console.log(`\n🔨 Building for ${target.toUpperCase()}...\n`);
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Copy manifest
  const manifestSrc = target === 'firefox'
    ? path.join(ROOT, 'manifest-firefox.json')
    : path.join(ROOT, 'manifest.json');
  copy(manifestSrc, path.join(DIST, 'manifest.json'));

  // Copy source files
  const filesToCopy = target === 'firefox' ? FIREFOX_FILES : CHROME_FILES;
  filesToCopy.forEach(f => copy(path.join(ROOT, f), path.join(DIST, f)));

  console.log(`\n✨ Build complete → dist/${target}/\n`);
}

build();
