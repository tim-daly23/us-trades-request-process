/**
 * Build the browser-tab icon from the transparent logo.
 *
 * The crest is 152x131 — wider than tall — and a favicon is square. Squashing
 * it to fit would distort the shield, so this pads it onto a transparent
 * square canvas instead, leaving the artwork's proportions alone.
 *
 *   node scripts/make-icon.js public/us-trades-logo.png app/icon.png
 */

const fs = require("fs");
const zlib = require("zlib");

// ---------------------------------------------------------------- shared

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
  let pos = 8;
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

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width: w, height: h } = ihdr;
  const stride = w * channels;
  const out = Buffer.alloc(stride * h);

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

  const rgba = Buffer.alloc(w * h * 4, 255);
  for (let i = 0; i < w * h; i++) {
    const s = i * channels;
    if (channels === 4) out.copy(rgba, i * 4, s, s + 4);
    else if (channels === 3) {
      rgba[i * 4] = out[s];
      rgba[i * 4 + 1] = out[s + 1];
      rgba[i * 4 + 2] = out[s + 2];
    }
  }
  return { width: w, height: h, rgba };
}

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
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- main

const [, , input, output] = process.argv;
const src = decode(input);

// Square canvas with a little breathing room, so the shield is not flush to
// the edge at 16px where browsers draw it with no margin of their own.
const pad = Math.round(Math.max(src.width, src.height) * 0.06);
const size = Math.max(src.width, src.height) + pad * 2;
const dst = Buffer.alloc(size * size * 4, 0); // fully transparent

const offX = Math.round((size - src.width) / 2);
const offY = Math.round((size - src.height) / 2);

for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const from = (y * src.width + x) * 4;
    const to = ((y + offY) * size + (x + offX)) * 4;
    src.rgba.copy(dst, to, from, from + 4);
  }
}

fs.writeFileSync(output, encode({ width: size, height: size, rgba: dst }));
console.log(
  `${input} (${src.width}x${src.height}) -> ${output} (${size}x${size}), ${fs.statSync(output).size} bytes`,
);
