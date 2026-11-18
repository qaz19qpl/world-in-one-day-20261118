// THE WORLD IN ONE DAY — front page for 18 November 2026.
// A from-scratch poster renderer: framebuffer, PNG encoder, 5x7 bitmap font.
// Node.js standard library only. Run: MAKEFUN_OUTPUT_DIR=out node main.ts

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const W = 1024;
const H = 1024;

// ---- palette: warm newsprint, ink, one accent per desk ----
const PAPER = [244, 239, 230];
const CARD = [253, 251, 247];
const INK = [26, 26, 26];
const MUTED = [88, 84, 76];
const WHITE = [255, 255, 255];
const RED = [178, 34, 28];
const NAVY = [31, 58, 95];
const TEAL = [14, 92, 84];
const OCHRE = [146, 104, 24];
const PLUM = [96, 48, 88];
const SLATE = [64, 74, 84];

// ---- framebuffer (RGB, row-major) ----
const fb = Buffer.alloc(W * H * 3);

function fillAll(c) {
  for (let i = 0; i < W * H; i++) {
    fb[i * 3] = c[0];
    fb[i * 3 + 1] = c[1];
    fb[i * 3 + 2] = c[2];
  }
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      fb[o] = c[0];
      fb[o + 1] = c[1];
      fb[o + 2] = c[2];
      o += 3;
    }
  }
}

function strokeRect(x, y, w, h, t, c) {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

// ---- 5x7 bitmap font ("1" = ink). Only capitals, digits and the marks used below. ----
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "|": ["00100", "00100", "00100", "00100", "00100", "00100", "00100"],
};

function glyph(ch) {
  return FONT[ch] || FONT["?"];
}

// Advance per character is 6*scale (5 px glyph + 1 px gap); no trailing gap.
function textWidth(s, scale) {
  if (!s) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(x, y, str, scale, color) {
  const s = String(str).toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === "1") fillRect(cx + c * scale, y + r * scale, scale, scale, color);
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(y, str, scale, color) {
  drawText(Math.round((W - textWidth(str, scale)) / 2), y, str, scale, color);
}

// Greedy word wrap; over-wide single words are hard-split by character.
function wrapText(str, maxWidth, scale) {
  const words = String(str).toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (textWidth(test, scale) <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const out = [];
  for (const ln of lines) {
    if (textWidth(ln, scale) <= maxWidth) {
      out.push(ln);
      continue;
    }
    let cur = "";
    for (const ch of ln) {
      if (textWidth(cur + ch, scale) > maxWidth && cur) {
        out.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

// ---- PNG encoder: signature, IHDR, IDAT (zlib), IEND; CRC-32 per chunk ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePNG(rgb, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Filter 0 (None) on every scanline; raw size h * (1 + 3w).
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- page content (wording written for this edition) ----
const PANELS = [
  {
    accent: RED,
    kicker: "THE GULF",
    headline: "IRAN HITS US SITES IN KUWAIT AND BAHRAIN",
    body: "Missiles struck American-linked targets in Kuwait and Bahrain before dawn, days after US jets hit missile sites on Qeshm Island.",
  },
  {
    accent: NAVY,
    kicker: "UKRAINE",
    headline: "KERCH BRIDGE HIT FOR SECOND DAY",
    body: "Ukrainian forces hit the Kerch Bridge for a second straight day, sending part of the road deck into the strait below.",
  },
  {
    accent: TEAL,
    kicker: "CHINA",
    headline: "XI AND PUTIN MEET IN SHENZHEN",
    body: "Xi Jinping and Vladimir Putin met in Shenzhen to align positions before tomorrow's three-way summit with Donald Trump.",
  },
  {
    accent: OCHRE,
    kicker: "GAZA",
    headline: "PEACE BOARD FAULTS BOTH SIDES",
    body: "Trump's peace board said Israel and Hamas have both failed to honor ceasefire pledges, in a blunt first report.",
  },
  {
    accent: PLUM,
    kicker: "THE PACIFIC",
    headline: "CYCLONE XAVIER SLAMS NORTH COOKS",
    body: "The Category 5 storm lashed the Northern Cook Islands with 315 km/h gusts. No deaths were reported.",
  },
  {
    accent: SLATE,
    kicker: "TECH",
    headline: "NVIDIA POSTS RECORD QUARTER",
    body: "Revenue reached 115.8 billion dollars, up 103 percent on the year, in the first results since Jensen Huang stepped down. The board refused his return.",
  },
];

function drawPanel(x, y, w, h, panel) {
  fillRect(x, y, w, h, CARD);
  strokeRect(x, y, w, h, 2, INK);
  fillRect(x + 2, y + 2, w - 4, 30, panel.accent);
  drawText(x + 14, y + 11, panel.kicker, 2, WHITE);
  const hx = x + 14;
  const hw = w - 28;
  const headLines = wrapText(panel.headline, hw, 3).slice(0, 2);
  const bodyLines = wrapText(panel.body, hw, 2);
  // Vertically centre the text block in the space below the kicker strip,
  // so short stories do not leave a large empty band at the panel foot.
  const headH = headLines.length * 26;
  const bodyH = bodyLines.length * 18;
  const blockH = headH + 12 + bodyH; // headline + accent rule gap + body
  let cy = y + 32 + Math.max(0, Math.floor((h - 32 - blockH) / 2));
  for (const ln of headLines) {
    drawText(hx, cy, ln, 3, INK);
    cy += 26;
  }
  fillRect(hx, cy + 2, 56, 3, panel.accent);
  cy += 12;
  for (const ln of bodyLines) {
    drawText(hx, cy, ln, 2, MUTED);
    cy += 18;
  }
}

// ---- compose the page ----
fillAll(PAPER);

// Masthead.
drawTextCentered(40, "THE WORLD IN ONE DAY", 7, INK);
fillRect(28, 100, W - 56, 5, RED);
drawTextCentered(118, "18 NOVEMBER 2026 / WEDNESDAY", 3, INK);
fillRect(28, 152, W - 56, 2, INK);

// Six panels: 2 columns x 3 rows.
const GRID_Y = 166;
const GAP = 14;
const COL_W = 477;
const ROW_H = 239;
PANELS.forEach((panel, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  drawPanel(28 + col * (COL_W + GAP), GRID_Y + row * (ROW_H + GAP), COL_W, ROW_H, panel);
});

// Footer ticker: two lines of late wires on an ink strip.
fillRect(28, 926, W - 56, 70, INK);
drawTextCentered(943, "WHO KEEPS EBOLA ALERT IN CONGO   |   PNG HIT BY 6.0 QUAKE", 2, PAPER);
drawTextCentered(965, "TRUMP MEETS MARCOS   |   MYANMAR TO REVIEW ASEAN TIES", 2, PAPER);

// ---- write the PNG (deterministic: no timestamps, fixed zlib level) ----
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
fs.mkdirSync(outDir, { recursive: true });
const png = encodePNG(fb, W, H);
const outPath = path.join(outDir, "poster.png");
fs.writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
