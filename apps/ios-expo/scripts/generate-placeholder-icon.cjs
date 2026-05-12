// Placeholder icon + splash generator for RateRadar iOS.
//
// We intentionally use the `pngjs` solid-cream fallback (not `canvas`):
//   - `canvas` requires node-gyp + libcairo and routinely fails on Windows
//     with Node 20+. The Wire Room BrandMark icon is regenerated in Phase 5
//     from a real PNG export. This file only needs to satisfy Apple's PNG
//     validation (correct dimensions, no alpha, valid PNG header) and the
//     Expo splash-screen plugin.
//
// To regenerate: `node scripts/generate-placeholder-icon.cjs`
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const CREAM = { r: 0xF5, g: 0xF1, b: 0xE8, a: 0xFF };

function emit(filename, size) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      png.data[i] = CREAM.r;
      png.data[i + 1] = CREAM.g;
      png.data[i + 2] = CREAM.b;
      png.data[i + 3] = CREAM.a;
    }
  }
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filename, buffer);
  console.log(`Wrote ${filename} (${size}x${size})`);
}

const out = path.join(__dirname, "..", "assets");
emit(path.join(out, "icon.png"), 1024);
emit(path.join(out, "adaptive-icon.png"), 1024);
emit(path.join(out, "splash.png"), 2048);
