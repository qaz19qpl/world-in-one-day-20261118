// The World in One Day — an entry for make.fun's news-image-20261118 bounty
// ("Sum up 18 November's world news in one image", $250).
//
// A Node 22 program, standard library only, that draws a one-page news poster
// of Wednesday 18 November 2026 from code — framebuffer, drawing primitives, a
// 5x7 bitmap font and six story panels — encodes it as a PNG and writes it to
// /output/entry.png (MAKEFUN_OUTPUT_DIR stands in for /output locally):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The drawing is fully deterministic: two runs write the same bytes.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- PNG encoder

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- canvas

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 231];
const INK: RGB = [22, 30, 46];
const RED: RGB = [176, 44, 38];
const BLUE: RGB = [36, 84, 158];
const SKY: RGB = [168, 198, 232];
const GOLD: RGB = [232, 163, 61];
const TEAL: RGB = [27, 110, 99];
const GREEN: RGB = [74, 128, 62];
const GREY: RGB = [105, 112, 124];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 12, 16];
const SEA: RGB = [58, 110, 160];
const SAND: RGB = [226, 205, 160];

function set(x: number, y: number, c: RGB): void {
  if (x >= 0 && x < W && y >= 0 && y < H) {
    const i = (y * W + x) * 3;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c);
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = cy - r; yy <= cy + r; yy++) {
    const dx = Math.floor(Math.sqrt(r * r - (yy - cy) * (yy - cy)));
    for (let xx = cx - dx; xx <= cx + dx; xx++) set(xx, yy, c);
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let yy = cy - r - t; yy <= cy + r + t; yy++) {
    for (let xx = cx - r - t; xx <= cx + r + t; xx++) {
      const d = Math.hypot(xx - cx, yy - cy);
      if (d >= r - t && d <= r + t) set(xx, yy, c);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    fillCircle(x, y, Math.floor(t / 2), c);
  }
}

function fillTri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.max(0, Math.min(x0, x1, x2)), maxX = Math.min(W - 1, Math.max(x0, x1, x2));
  const minY = Math.max(0, Math.min(y0, y1, y2)), maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / area;
      const w1 = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) set(x, y, c);
    }
  }
}

// A four-point starburst (explosion / sparkle), centred, alternating radii.
function burst(cx: number, cy: number, rOut: number, rIn: number, points: number, c: RGB): void {
  const verts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI * i) / points - Math.PI / 2;
    verts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    fillTri(cx, cy, a[0], a[1], b[0], b[1], c);
  }
}

// --------------------------------------------------------------------- font
// A 5x7 bitmap font, drawn from row strings; '#' is a lit pixel.

const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '....#', '....#', '....#', '....#', '#...#', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
};

function textWidth(text: string, scale: number): number {
  return text.length === 0 ? 0 : text.length * 6 * scale - scale;
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB, bold = false): void {
  const passes = bold ? [0, Math.max(1, scale - 1)] : [0];
  for (const off of passes) {
    let cx = x + off;
    for (const ch of text.toUpperCase()) {
      const glyph = FONT[ch] ?? FONT[' '];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === '#') fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
      cx += 6 * scale;
    }
  }
}

function drawTextCentered(text: string, cx: number, y: number, scale: number, c: RGB, bold = false): void {
  drawText(text, Math.round(cx - textWidth(text, scale) / 2), y, scale, c, bold);
}

// Word-wrap a caption into lines of at most maxChars characters.
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------- scenes
// Each scene draws inside the panel's illustration box (ix, iy, 472 x 96).

function sceneBridge(ix: number, iy: number): void {
  fillRect(ix, iy, 472, 58, SKY);
  fillRect(ix, iy + 58, 472, 38, SEA);
  fillRect(ix + 126, iy + 16, 12, 42, INK);
  fillRect(ix + 334, iy + 16, 12, 42, INK);
  line(ix + 132, iy + 20, ix + 12, iy + 52, 2, INK);
  line(ix + 132, iy + 20, ix + 224, iy + 52, 2, INK);
  line(ix + 340, iy + 20, ix + 320, iy + 52, 2, INK);
  line(ix + 340, iy + 20, ix + 460, iy + 52, 2, INK);
  fillRect(ix + 10, iy + 50, 214, 7, INK); // left deck
  fillRect(ix + 318, iy + 50, 144, 7, INK); // right deck
  line(ix + 222, iy + 54, ix + 272, iy + 82, 7, INK); // fallen span
  burst(ix + 306, iy + 38, 27, 11, 8, GOLD);
  burst(ix + 306, iy + 38, 14, 6, 8, RED);
  fillCircle(ix + 330, iy + 16, 8, GREY);
  fillCircle(ix + 348, iy + 9, 6, GREY);
  fillCircle(ix + 292, iy + 12, 5, GREY);
}

function sceneSummit(ix: number, iy: number): void {
  const flag = (fx: number, kind: number): void => {
    line(fx, iy + 6, fx, iy + 90, 4, INK);
    const x = fx + 3, y = iy + 8, w = 88, h = 46;
    if (kind === 0) { // United States
      fillRect(x, y, w, h, WHITE);
      for (let i = 0; i < 7; i += 2) fillRect(x, y + i * 7, w, 7, RED);
      fillRect(x, y, 38, 25, BLUE);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) fillCircle(x + 6 + c * 10, y + 5 + r * 8, 2, WHITE);
    } else if (kind === 1) { // China
      fillRect(x, y, w, h, RED);
      fillCircle(x + 13, y + 12, 5, GOLD);
      fillCircle(x + 27, y + 6, 2, GOLD);
      fillCircle(x + 31, y + 13, 2, GOLD);
      fillCircle(x + 31, y + 21, 2, GOLD);
      fillCircle(x + 27, y + 27, 2, GOLD);
    } else { // Russia
      fillRect(x, y, w, 16, WHITE);
      fillRect(x, y + 16, w, 15, BLUE);
      fillRect(x, y + 31, w, 15, RED);
    }
    fillRect(x, y, w, 2, INK);
  };
  flag(ix + 40, 0);
  flag(ix + 192, 1);
  flag(ix + 344, 2);
  fillRect(ix + 16, iy + 90, 440, 4, INK);
}

function sceneGulf(ix: number, iy: number): void {
  fillRect(ix, iy + 78, 472, 18, SAND);
  // drone
  const dx = ix + 92, dy = iy + 28;
  line(dx - 26, dy - 14, dx + 26, dy + 14, 3, INK);
  line(dx - 26, dy + 14, dx + 26, dy - 14, 3, INK);
  fillCircle(dx, dy, 10, INK);
  for (const [ox, oy] of [[-30, -17], [30, -17], [-30, 17], [30, 17]] as const) ring(dx + ox, dy + oy, 7, 2, INK);
  // dotted path
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = Math.round(dx + 30 + (ix + 356 - dx - 30) * t);
    const y = Math.round(dy + 6 + Math.sin(t * Math.PI) * -8 + (iy + 62 - dy) * t);
    fillCircle(x, y, 2, GREY);
  }
  // base with radar
  fillRect(ix + 356, iy + 70, 96, 22, INK);
  line(ix + 404, iy + 70, ix + 404, iy + 44, 3, INK);
  ring(ix + 404, iy + 36, 12, 3, TEAL);
  burst(ix + 350, iy + 62, 17, 7, 8, GOLD);
  burst(ix + 350, iy + 62, 9, 4, 8, RED);
}

function scenePeace(ix: number, iy: number): void {
  // A peace-plan document, cracked down the middle, between two olive branches.
  const olive = (bx: number, flip: number): void => {
    line(bx, iy + 88, bx + flip * 14, iy + 14, 4, GREEN);
    for (const [ox, oy] of [[0, 74], [6, 58], [10, 42], [13, 26]] as const) {
      fillCircle(bx + flip * ox, iy + oy, 7, GREEN);
      fillCircle(bx - flip * 6 + flip * ox, iy + oy + 8, 6, GREEN);
    }
  };
  olive(ix + 56, 1);
  olive(ix + 416, -1);
  // document
  const dx = ix + 166, dy = iy + 6, dw = 140, dh = 84;
  fillRect(dx, dy, dw, dh, WHITE);
  fillRect(dx, dy, dw, 3, INK); fillRect(dx, dy + dh - 3, dw, 3, INK);
  fillRect(dx, dy, 3, dh, INK); fillRect(dx + dw - 3, dy, 3, dh, INK);
  fillRect(dx + 14, dy + 12, 112, 6, RED);
  for (let r = 0; r < 4; r++) fillRect(dx + 14, dy + 28 + r * 11, 112 - r * 18, 4, GREY);
  // red zigzag crack splitting the page
  const cx = dx + dw / 2;
  const crack: [number, number][] = [[0, 0], [-9, 14], [8, 28], [-8, 42], [9, 56], [-6, 70], [4, 84]];
  for (let i = 0; i + 1 < crack.length; i++) {
    line(Math.round(cx + crack[i][0]), dy + crack[i][1], Math.round(cx + crack[i + 1][0]), dy + crack[i + 1][1], 4, RED);
  }
  burst(ix + 96, iy + 20, 15, 6, 8, GOLD);
  burst(ix + 376, iy + 76, 15, 6, 8, GOLD);
}

function sceneCyclone(ix: number, iy: number): void {
  fillRect(ix, iy, 472, 62, SKY);
  fillRect(ix, iy + 62, 472, 34, SEA);
  // spiral: concentric swirl rings over the sea
  const cx = ix + 236, cy = iy + 46;
  ring(cx, cy, 40, 5, WHITE);
  ring(cx, cy, 28, 5, WHITE);
  ring(cx, cy, 16, 4, WHITE);
  fillCircle(cx, cy, 7, INK);
  // spiral arms
  line(cx - 44, cy - 26, cx - 18, cy - 8, 5, WHITE);
  line(cx + 44, cy + 26, cx + 18, cy + 8, 5, WHITE);
  line(cx - 40, cy + 30, cx - 14, cy + 12, 5, WHITE);
  line(cx + 40, cy - 30, cx + 14, cy - 12, 5, WHITE);
  // atoll island, bottom left, with a palm
  fillRect(ix + 18, iy + 78, 120, 18, SAND);
  line(ix + 66, iy + 78, ix + 66, iy + 46, 4, INK);
  line(ix + 66, iy + 48, ix + 42, iy + 60, 3, GREEN);
  line(ix + 66, iy + 48, ix + 90, iy + 60, 3, GREEN);
  line(ix + 66, iy + 48, ix + 66, iy + 66, 3, GREEN);
  // rain, right side
  for (let i = 0; i < 8; i++) {
    const rx = ix + 360 + i * 13, ry = iy + 8 + (i % 3) * 12;
    line(rx, ry, rx - 6, ry + 12, 2, GREY);
  }
  // wave crests
  for (const wx of [180, 260, 340, 420] as const) {
    line(ix + wx, iy + 84, ix + wx + 22, iy + 84, 3, WHITE);
  }
}

function sceneNvidia(ix: number, iy: number): void {
  fillRect(ix, iy, 472, 96, INK);
  // rising bars, left
  fillRect(ix + 28, iy + 66, 34, 22, TEAL);
  fillRect(ix + 76, iy + 52, 34, 36, TEAL);
  fillRect(ix + 124, iy + 36, 34, 52, GREEN);
  fillRect(ix + 172, iy + 18, 34, 70, GREEN);
  line(ix + 28, iy + 60, ix + 220, iy + 10, 3, GOLD);
  fillTri(ix + 220, iy + 10, ix + 204, iy + 10, ix + 216, iy + 22, GOLD);
  // chip, right
  const cx = ix + 296, cy = iy + 18, cw = 140, ch = 60;
  for (let i = 0; i < 5; i++) {
    fillRect(cx + 12 + i * 26, cy - 8, 8, 8, GOLD);
    fillRect(cx + 12 + i * 26, cy + ch, 8, 8, GOLD);
  }
  fillRect(cx, cy, cw, ch, GREEN);
  fillRect(cx, cy, cw, 3, GOLD); fillRect(cx, cy + ch - 3, cw, 3, GOLD);
  fillRect(cx, cy, 3, ch, GOLD); fillRect(cx + cw - 3, cy, 3, ch, GOLD);
  fillRect(cx + 44, cy + 16, 52, 28, INK);
  fillRect(cx + 52, cy + 23, 36, 14, GOLD);
  // sparks
  burst(ix + 452, iy + 14, 12, 5, 8, GOLD);
  burst(ix + 250, iy + 82, 10, 4, 8, GOLD);
}

// -------------------------------------------------------------------- page

function panel(x: number, y: number, accent: RGB, kicker: string, head: [string, string], caption: string, scene: (a: number, b: number) => void): void {
  fillRect(x, y, 492, 240, WHITE);
  fillRect(x, y, 492, 3, INK); fillRect(x, y + 237, 492, 3, INK);
  fillRect(x, y, 3, 240, INK); fillRect(x + 489, y, 3, 240, INK);
  fillRect(x + 3, y + 3, 486, 26, accent);
  drawText(kicker, x + 14, y + 9, 2, accent === GOLD ? INK : WHITE, true);
  scene(x + 10, y + 36);
  drawText(head[0], x + 14, y + 142, 3, INK, true);
  drawText(head[1], x + 14, y + 168, 3, INK, true);
  const lines = wrap(caption, 38);
  lines.slice(0, 2).forEach((ln, i) => drawText(ln, x + 14, y + 202 + i * 18, 2, GREY));
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);
  // header
  fillRect(0, 0, W, 168, INK);
  drawTextCentered('THE WORLD IN ONE DAY', W / 2, 16, 3, GOLD, true);
  drawTextCentered('18 NOVEMBER 2026', W / 2, 48, 7, WHITE, true);
  drawTextCentered('WEDNESDAY - AS IT HAPPENED, AROUND THE WORLD', W / 2, 118, 3, GOLD);
  fillRect(0, 168, W, 6, RED);
  // panels
  const X0 = 14, X1 = 518, Y = [190, 442, 694];
  panel(X0, Y[0], TEAL, 'GULF - IRAN AND THE US', ['IRAN STRIKES KUWAIT', '+ BAHRAIN AFTER US HIT'], 'IRAN HITS GULF BASES HOURS AFTER US JETS STRUCK QESHM ISLAND.', sceneGulf);
  panel(X1, Y[0], RED, 'UKRAINE - WAR IN EUROPE', ['KERCH BRIDGE PARTLY', 'COLLAPSES, DAY TWO'], 'UKRAINE HITS THE BRIDGE FOR A SECOND DAY; ROAD SPAN FALLS INTO THE SEA.', sceneBridge);
  panel(X0, Y[1], BLUE, 'CHINA - DIPLOMACY', ['XI MEETS PUTIN IN', 'SHENZHEN BEFORE SUMMIT'], 'FIRST US-CHINA-RUSSIA SUMMIT DUE THURSDAY; XI DENOUNCES PROTECTIONISM.', sceneSummit);
  panel(X1, Y[1], GOLD, 'GAZA - CEASEFIRE AT RISK', ['BOARD OF PEACE FAULTS', 'ISRAEL AND HAMAS'], 'TRUMP BODY SAYS BOTH SIDES BROKE CEASEFIRE DEALS; GAZA PLAN STALLS.', scenePeace);
  panel(X0, Y[2], SEA, 'PACIFIC - CYCLONE', ['CYCLONE XAVIER HITS', 'COOK ISLANDS, CAT 5'], 'GUSTS TO 315 KM/H; SHELTERS OPEN ON NORTHERN ATOLLS. NO DEATHS REPORTED.', sceneCyclone);
  panel(X1, Y[2], GREEN, 'TECH - AI CHIPS', ['NVIDIA POSTS RECORD', '115.8 BILLION QUARTER'], 'REVENUE DOUBLES IN FIRST RESULTS SINCE HUANG QUIT; BOARD REJECTS HIS RETURN.', sceneNvidia);
  // footer ticker
  fillRect(0, 946, W, 78, INK);
  drawText('ALSO: WHO KEEPS EBOLA EMERGENCY AS CASES TOP 11,000 ++ 6.0 QUAKE IN PNG', 16, 958, 2, WHITE);
  drawText('TRUMP MEETS MARCOS BEFORE CHINA TRIP ++ MYANMAR TO REVIEW ASEAN TIES', 16, 984, 2, GOLD);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePng(W, H, px);
  writeFileSync(join(outDir, 'entry.png'), png);
  console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes)`);
}

main();
