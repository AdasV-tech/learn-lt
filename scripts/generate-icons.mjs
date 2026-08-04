#!/usr/bin/env node
/**
 * Generate the PWA icons.
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes frontend/public/icon-192.png and icon-512.png. Encoding the PNGs here
 * rather than committing binaries keeps the icon definition readable and
 * reviewable, and avoids a native image dependency in the install.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'frontend/public');

const COLORS = {
  bg: [13, 23, 18, 255], // base-950
  yellow: [253, 185, 19, 255],
  green: [0, 106, 68, 255],
  red: [193, 39, 45, 255],
  signal: [74, 222, 128, 255],
};

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encode an RGBA pixel buffer as a PNG. */
function encodePng(width, height, pixels) {
  const stride = width * 4;
  // Each scanline is prefixed with a filter byte; 0 = None.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Kalba's mark: a rounded dark tile with the Lithuanian flag inside a signal-green frame. */
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const inset = size * 0.19;
  const flagTop = size * 0.25;
  const flagHeight = size * 0.5;
  const bandHeight = flagHeight / 3;
  const frame = Math.max(2, Math.round(size * 0.035));

  const put = (x, y, [r, g, b, a]) => {
    const i = (y * size + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  };

  const insideRounded = (x, y) => {
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!insideRounded(x + 0.5, y + 0.5)) {
        put(x, y, [0, 0, 0, 0]);
        continue;
      }

      const inFlagX = x >= inset && x < size - inset;
      const inFlagY = y >= flagTop && y < flagTop + flagHeight;

      if (inFlagX && inFlagY) {
        const onFrame =
          x < inset + frame ||
          x >= size - inset - frame ||
          y < flagTop + frame ||
          y >= flagTop + flagHeight - frame;
        if (onFrame) {
          put(x, y, COLORS.signal);
        } else {
          const band = Math.floor((y - flagTop) / bandHeight);
          put(x, y, band === 0 ? COLORS.yellow : band === 1 ? COLORS.green : COLORS.red);
        }
      } else {
        put(x, y, COLORS.bg);
      }
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = resolve(outDir, `icon-${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log(`  ✓ ${file}`);
}
