/**
 * Make a logo's white background transparent.
 *
 * Node has zlib, which is all a PNG really needs, so this decodes and
 * re-encodes without a dependency.
 *
 * The important part is that it does NOT simply turn every white pixel
 * transparent — the crest has white lettering inside it, which that would
 * erase. Instead it flood-fills inward from the border, so only white that is
 * connected to the outside edge is removed.
 *
 *   node scripts/key-out-white.js public/us-trades-logo.png public/out.png
 */

const fs = require("fs");
const zlib = require("zlib");

// ---------------------------------------------------------------- decode

function crcTable() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decode(file) {
  const buf = fs.readFileSync(file);
  let pos = 8; // skip signature
  let ihdr = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    pos += 12 + len;
  }

  if (ihdr.depth !== 8) throw new Error(`unsupported bit depth ${ihdr.depth}`);
  if (ihdr.interlace !== 0) throw new Error("interlaced PNG not supported");
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType];
  if (!channels) throw new Error(`unsupported colour type ${ihdr.colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width: w, height: h } = ihdr;
  const stride = w * channels;
  const out = Buffer.alloc(stride * h);

  // Undo per-scanline filtering.
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 0xff;
    }
  }

  // Normalize to RGBA.
  const rgba = Buffer.alloc(w * h * 4, 255);
  for (let i = 0; i < w * h; i++) {
    const s = i * channels;
    if (channels === 3) {
      rgba[i * 4] = out[s];
      rgba[i * 4 + 1] = out[s + 1];
      rgba[i * 4 + 2] = out[s + 2];
    } else if (channels === 4) {
      out.copy(rgba, i * 4, s, s + 4);
    } else {
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = out[s];
      if (channels === 2) rgba[i * 4 + 3] = out[s + 1];
    }
  }
  return { width: w, height: h, rgba };
}

// ---------------------------------------------------------------- encode

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encode({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- key

function keyOutWhite(img, { threshold = 232, feather = 250 } = {}) {
  const { width: w, height: h, rgba } = img;
  const isNearWhite = (i, t) =>
    rgba[i * 4] >= t && rgba[i * 4 + 1] >= t && rgba[i * 4 + 2] >= t;

  // Flood fill inward from every border pixel. Only white connected to the
  // outside is background; white inside the crest is lettering and stays.
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }

  let cleared = 0;
  while (stack.length) {
    const i = stack.pop();
    if (seen[i]) continue;
    seen[i] = 1;
    if (!isNearWhite(i, threshold)) continue;
    rgba[i * 4 + 3] = 0;
    cleared++;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }

  // Soften the 1px halo the original anti-aliasing left behind: a pixel that
  // still reads as near-white and touches transparency gets partial alpha
  // scaled by how white it is. Without this the crest keeps a bright rim on a
  // dark background.
  let feathered = 0;
  const alphaOf = (i) => rgba[i * 4 + 3];
  const copy = Buffer.from(rgba);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (alphaOf(i) === 0) continue;
      const touchesHole =
        (x > 0 && copy[(i - 1) * 4 + 3] === 0) ||
        (x < w - 1 && copy[(i + 1) * 4 + 3] === 0) ||
        (y > 0 && copy[(i - w) * 4 + 3] === 0) ||
        (y < h - 1 && copy[(i + w) * 4 + 3] === 0);
      if (!touchesHole) continue;
      const lum = Math.max(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
      if (lum < feather - 40) continue;
      rgba[i * 4 + 3] = Math.max(0, Math.min(255, 255 - (lum - (feather - 40)) * 6));
      feathered++;
    }
  }

  return { cleared, feathered };
}

// ---------------------------------------------------------------- main

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("usage: node scripts/key-out-white.js <in.png> <out.png>");
  process.exit(1);
}

const img = decode(input);
const stats = keyOutWhite(img);
fs.writeFileSync(output, encode(img));

const total = img.width * img.height;
console.log(`${input} -> ${output}`);
console.log(`  ${img.width}x${img.height}`);
console.log(`  cleared   ${stats.cleared} px (${((stats.cleared / total) * 100).toFixed(1)}% of image)`);
console.log(`  feathered ${stats.feathered} px on the edge`);
console.log(`  ${fs.statSync(output).size} bytes`);
