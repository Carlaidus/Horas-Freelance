/* Genera public/icons/icon-192.png y icon-512.png sin dependencias externas.
   Diseño: fondo oscuro #0d0d0f, cuadrado redondeado dorado #c8a84b.
   Ejecutar una sola vez: node scripts/generate-icons.js             */

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type);
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(size, drawFn) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x / size, y / size);
      row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function draw(u, v) {
  const x = u - 0.5, y = v - 0.5;
  const r = 0.30, br = 0.07;
  const qx = Math.abs(x) - r + br, qy = Math.abs(y) - r + br;
  const d  = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2)
           + Math.min(Math.max(qx, qy), 0) - br;
  return d < 0 ? [200, 168, 75] : [13, 13, 15];
}

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), makePNG(size, draw));
  console.log(`✓ icon-${size}.png (${size}×${size})`);
}
