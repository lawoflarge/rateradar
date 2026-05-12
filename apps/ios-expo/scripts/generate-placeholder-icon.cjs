// Wire Room BrandMark icon + splash generator for RateRadar iOS.
//
// We render via the `pngjs` library (no native canvas dep — node-gyp + libcairo
// is unreliable on Windows + Node 20+). Math: concentric ink rings with an
// amber sparkline pointing toward NNE — see `docs/PRD.md` § visual identity.
//
// To regenerate: `node scripts/generate-placeholder-icon.cjs`
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const CREAM = [0xF5, 0xF1, 0xE8, 0xFF];
const INK = [0x0E, 0x0E, 0x0E, 0xFF];
const CUT = [0xC8, 0x84, 0x1C, 0xFF];

function blend(rgba1, rgba2, t) {
  return [
    Math.round(rgba1[0] * (1 - t) + rgba2[0] * t),
    Math.round(rgba1[1] * (1 - t) + rgba2[1] * t),
    Math.round(rgba1[2] * (1 - t) + rgba2[2] * t),
    0xFF,
  ];
}

function setPx(png, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  const existing = [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
  const blended = blend(existing, color, alpha);
  png.data[i] = blended[0];
  png.data[i + 1] = blended[1];
  png.data[i + 2] = blended[2];
  png.data[i + 3] = blended[3];
}

function fill(png, color) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = color[0];
      png.data[i + 1] = color[1];
      png.data[i + 2] = color[2];
      png.data[i + 3] = color[3];
    }
  }
}

function ring(png, cx, cy, r, strokeWidth, color) {
  const inner = r - strokeWidth / 2;
  const outer = r + strokeWidth / 2;
  for (let y = Math.floor(cy - outer - 1); y <= Math.ceil(cy + outer + 1); y++) {
    for (let x = Math.floor(cx - outer - 1); x <= Math.ceil(cx + outer + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= inner - 0.5 && dist <= outer + 0.5) {
        let a = 1;
        if (dist < inner) a = 1 - (inner - dist);
        else if (dist > outer) a = 1 - (dist - outer);
        a = Math.max(0, Math.min(1, a));
        setPx(png, x, y, color, a);
      }
    }
  }
}

function disc(png, cx, cy, r, color) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r + 0.5) {
        const a = Math.max(0, Math.min(1, r - dist + 0.5));
        setPx(png, x, y, color, a);
      }
    }
  }
}

function line(png, x0, y0, x1, y1, w, color) {
  const minX = Math.floor(Math.min(x0, x1) - w);
  const maxX = Math.ceil(Math.max(x0, x1) + w);
  const minY = Math.floor(Math.min(y0, y1) - w);
  const maxY = Math.ceil(Math.max(y0, y1) + w);
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      let t = ((px - x0) * dx + (py - y0) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = x0 + t * dx, cy = y0 + t * dy;
      const ddx = px - cx, ddy = py - cy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist <= w / 2 + 0.5) {
        const a = Math.max(0, Math.min(1, w / 2 - dist + 0.5));
        setPx(png, x, y, color, a);
      }
    }
  }
}

function brandMark(png) {
  fill(png, CREAM);
  const w = png.width;
  const cx = w / 2, cy = png.height / 2;
  const outerR = w * 0.40;
  const midR = w * 0.25;
  const innerR = w * 0.10;
  const outerStroke = w * 0.025;
  const innerStroke = w * 0.012;
  ring(png, cx, cy, outerR, outerStroke, INK);
  ring(png, cx, cy, midR, innerStroke, INK);
  ring(png, cx, cy, innerR, innerStroke, INK);
  // 340° in screen coords (Y-down): -20° from +X axis points up-right (NNE).
  const angle = (-Math.PI / 180) * 20;
  const lineLen = outerR * 0.8;
  const lx = cx + lineLen * Math.cos(angle);
  const ly = cy + lineLen * Math.sin(angle);
  line(png, cx, cy, lx, ly, w * 0.035, CUT);
  disc(png, lx, ly, w * 0.04, CUT);
}

function emit(filename, size, isSplash = false) {
  const png = new PNG({ width: size, height: size });
  if (isSplash) {
    fill(png, CREAM);
    const subSize = Math.round(size * 0.4);
    const sub = new PNG({ width: subSize, height: subSize });
    brandMark(sub);
    const offX = Math.round((size - sub.width) / 2);
    const offY = Math.round((size - sub.height) / 2);
    for (let y = 0; y < sub.height; y++) {
      for (let x = 0; x < sub.width; x++) {
        const si = (y * sub.width + x) * 4;
        const di = ((y + offY) * png.width + (x + offX)) * 4;
        png.data[di] = sub.data[si];
        png.data[di + 1] = sub.data[si + 1];
        png.data[di + 2] = sub.data[si + 2];
        png.data[di + 3] = sub.data[si + 3];
      }
    }
  } else {
    brandMark(png);
  }
  fs.writeFileSync(filename, PNG.sync.write(png));
  console.log(`Wrote ${filename} (${size}x${size})`);
}

const out = path.join(__dirname, "..", "assets");
emit(path.join(out, "icon.png"), 1024);
emit(path.join(out, "adaptive-icon.png"), 1024);
emit(path.join(out, "splash.png"), 2048, true);
