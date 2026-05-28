// 의존성 없이 zlib로 PNG 포켓볼 아이콘을 생성한다.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function drawPixel(N, x, y) {
  const cx = N / 2, cy = N / 2;
  const R = N * 0.42;
  const band = N * 0.045;
  const btnR = N * 0.13;
  const ring = N * 0.035;
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  // 배경 (둥근 사각형 느낌은 생략하고 단색)
  let col = [0xb8, 0x1e, 0x00, 255];
  if (d <= R) {
    col = (dy < 0) ? [0xe3, 0x35, 0x0d, 255] : [0xff, 0xff, 0xff, 255];
    if (Math.abs(dy) <= band) col = [0x1c, 0x1c, 0x1e, 255];        // 가운데 검은 띠
    if (d <= btnR + ring) col = [0x1c, 0x1c, 0x1e, 255];            // 버튼 검은 테
    if (d <= btnR) col = [0xff, 0xff, 0xff, 255];                   // 버튼 흰 중앙
    if (d > R - N * 0.012) col = [0x1c, 0x1c, 0x1e, 255];           // 외곽선
  }
  return col;
}

function makePNG(N) {
  const stride = N * 4 + 1;
  const raw = Buffer.alloc(stride * N);
  for (let y = 0; y < N; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < N; x++) {
      const [r, g, b, a] = drawPixel(N, x + 0.5, y + 0.5);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit, RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'icons');
for (const N of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${N}.png`), makePNG(N));
  console.log(`wrote icon-${N}.png`);
}
