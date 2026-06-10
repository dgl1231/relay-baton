// Deterministically generate desktop/icon-source.png — a simple 512x512
// relay-baton mark (dark tile, rounded corners, amber "baton" diagonal) —
// without any image library. `tauri icon` then derives the full per-OS icon
// set from this file (icon.ico / icon.icns / sized PNGs).
//
// Pure Node (zlib + manual PNG chunks) so the asset is reproducible from the
// repo on any machine: node scripts/gen-icon-source.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 512;

// --- draw into an RGBA buffer ---
const px = Buffer.alloc(SIZE * SIZE * 4);

const BG = [13, 17, 23, 255]; // #0d1117 (matches the webview theme)
const FG = [240, 180, 41, 255]; // amber baton
const RADIUS = 96; // rounded-corner radius of the tile

function inTile(x, y) {
  // rounded rect over the full canvas
  const r = RADIUS;
  const cx = x < r ? r : x >= SIZE - r ? SIZE - r - 1 : x;
  const cy = y < r ? r : y >= SIZE - r ? SIZE - r - 1 : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inBaton(x, y) {
  // a thick diagonal bar (the baton), from lower-left to upper-right,
  // with rounded ends — distance from the segment center line.
  const x0 = 150, y0 = 362, x1 = 362, y1 = 150, half = 56;
  const vx = x1 - x0, vy = y1 - y0;
  const len2 = vx * vx + vy * vy;
  let t = ((x - x0) * vx + (y - y0) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = x - (x0 + t * vx);
  const dy = y - (y0 + t * vy);
  return dx * dx + dy * dy <= half * half;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    if (!inTile(x, y)) {
      px[i + 3] = 0; // transparent outside the rounded tile
      continue;
    }
    const c = inBaton(x, y) ? FG : BG;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  }
}

// --- encode as PNG (8-bit RGBA, no interlace) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA

// raw scanlines, filter byte 0 per row
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "icon-source.png");
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
