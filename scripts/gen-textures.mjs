/**
 * Generates the tileable textures behind the page's grit.
 *
 *   public/dirt.png   alpha mask — an opaque sheet chewed by pinholes, dust and scratches.
 *                     Masks headings, so the letters lose bits of themselves.
 *   public/grain.png  dark ink mottle — painted inside letters and across panels, so
 *                     surfaces read as screen-printed rather than flat.
 *   public/film.png   light *and* dark dirt — the fixed, full-viewport pass. Lives over
 *                     the whole page like muck on a lens.
 *
 * All three wrap seamlessly. Re-run after touching the knobs:  npm run textures
 * Set PREVIEW=<dir> to also dump flattened, human-readable copies.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- 8-bit grayscale+alpha PNG ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** px: 2 bytes per pixel (gray, alpha), row-major. */
function encodePng(size, px) {
  const stride = size * 2;
  const raw = Buffer.alloc((stride + 1) * size);
  const prev = Buffer.alloc(stride);
  const none = Buffer.alloc(stride);
  const up = Buffer.alloc(stride);

  for (let y = 0; y < size; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride);
    let costNone = 0;
    let costUp = 0;
    for (let i = 0; i < stride; i++) {
      none[i] = row[i];
      up[i] = (row[i] - prev[i]) & 0xff;
      costNone += none[i] < 128 ? none[i] : 256 - none[i];
      costUp += up[i] < 128 ? up[i] : 256 - up[i];
    }
    const useUp = costUp < costNone;
    raw[y * (stride + 1)] = useUp ? 2 : 0;
    (useUp ? up : none).copy(raw, y * (stride + 1) + 1);
    prev.set(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 4; // color type: grayscale + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- noise ---------- */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mod = (v, n) => ((v % n) + n) % n;

function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Value noise on a lattice that wraps every `period` units — hence tileable. */
function noise(lat, period, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smoothstep(0, 1, x - xi);
  const v = smoothstep(0, 1, y - yi);
  const x0 = mod(xi, period);
  const y0 = mod(yi, period);
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = lat[y0 * period + x0];
  const b = lat[y0 * period + x1];
  const c = lat[y1 * period + x0];
  const d = lat[y1 * period + x1];
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/** Fractal sum of wrapping value noise, normalised to 0..1. */
function fbm(size, basePeriod, octaves, rand) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const period = Math.min(basePeriod << o, size);
    const lat = new Float32Array(period * period);
    for (let i = 0; i < lat.length; i++) lat[i] = rand();
    const scale = period / size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        out[y * size + x] += amp * noise(lat, period, x * scale, y * scale);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function whiteNoise(size, rand) {
  const out = new Float32Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = rand();
  return out;
}

/** Long thin drags that skip and re-catch. Returns 0..1 coverage, wrapping seamlessly. */
function scratchField(size, count, rand) {
  const field = new Float32Array(size * size);
  for (let n = 0; n < count; n++) {
    const ang = rand() * Math.PI * 2;
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    const len = size * (1.2 + rand());
    const r = 0.5 + rand() * 1.1;
    const strength = 0.45 + rand() * 0.45;
    const wobble = 0.6 + rand() * 2.4;
    const wobbleFreq = 0.01 + rand() * 0.03;
    const p1 = rand() * 100;
    const p2 = rand() * 100;
    const x0 = rand() * size;
    const y0 = rand() * size;
    const reach = Math.ceil(r) + 1;

    for (let t = 0; t < len; t += 0.35) {
      const env = Math.sin(t * 0.013 + p1) * Math.sin(t * 0.037 + p2);
      if (env < 0.05) continue;
      const off = Math.sin(t * wobbleFreq + p1) * wobble;
      const px = x0 + nx * t - ny * off;
      const py = y0 + ny * t + nx * off;
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const dist = Math.hypot(ix + dx + 0.5 - px, iy + dy + 0.5 - py);
          if (dist > r) continue;
          const idx = mod(iy + dy, size) * size + mod(ix + dx, size);
          field[idx] = Math.max(field[idx], strength * env * (1 - dist / r));
        }
      }
    }
  }
  return field;
}

/** Irregular flecks. `plot(idx, dist)` gets 0..1 distance from the blob centre. */
function specks(size, count, rand, minR, maxR, plot) {
  for (let n = 0; n < count; n++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = minR + rand() * rand() * (maxR - minR);
    const squash = 0.6 + rand() * 0.9;
    const rot = rand() * Math.PI;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const reach = Math.ceil(r) + 1;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const u = (dx * cos + dy * sin) / r;
        const v = (-dx * sin + dy * cos) / (r * squash);
        const dist = Math.hypot(u, v);
        if (dist > 1) continue;
        plot(mod(Math.round(cy + dy), size) * size + mod(Math.round(cx + dx), size), dist);
      }
    }
  }
}

/* ---------- dirt: the mask that eats the letters ---------- */

const DIRT = {
  size: 512,
  seed: 20260525,
  pinholeBase: 0.014, // holes punched everywhere
  pinholeGrime: 0.1, // extra holes inside the grimy patches
  toothBite: 0.34, // how hard the fine chew thins the ink
  dustPer: 4200, // one dust blob per N pixels
  scratches: 8,
};

function dirt(k = DIRT) {
  const { size } = k;
  const rand = rng(k.seed);
  const alpha = new Float32Array(size * size).fill(1);

  const grime = fbm(size, 5, 5, rand); // where the dirt collects
  const tooth = fbm(size, 32, 3, rand); // fine chew along the ink
  const white = whiteNoise(size, rand);

  for (let i = 0; i < alpha.length; i++) {
    const d = smoothstep(0.4, 0.8, grime[i]);
    const cut = k.pinholeBase + k.pinholeGrime * d;
    if (white[i] < cut) alpha[i] *= 0.05 + (0.3 * white[i]) / cut;
    alpha[i] *= 1 - k.toothBite * d * smoothstep(0.55, 0.95, tooth[i]);
  }

  specks(size, Math.round((size * size) / k.dustPer), rand, 1.2, 5.4, (idx, dist) => {
    alpha[idx] = Math.min(alpha[idx], 0.06 + 0.7 * smoothstep(0.55, 1, dist));
  });

  const scratch = scratchField(size, k.scratches, rand);

  const px = new Uint8Array(size * size * 2);
  let sum = 0;
  for (let i = 0; i < alpha.length; i++) {
    const a = clamp(alpha[i] * (1 - scratch[i]), 0, 1);
    sum += a;
    px[i * 2] = 255;
    px[i * 2 + 1] = Math.round(a * 255);
  }
  return { size, px, stat: `ink kept ${((sum / alpha.length) * 100).toFixed(1)}%` };
}

/* ---------- grain: the ink mottle inside letters and panels ---------- */

const GRAIN = {
  size: 256,
  seed: 909,
  gray: 12, // near-black, so it reads as ink starved of colour
  speckle: 0.3,
  pooling: 0.42,
  fiber: 0.16,
  cap: 0.72, // never fully opaque — what is underneath must stay readable
};

function grain(k = GRAIN) {
  const { size } = k;
  const rand = rng(k.seed);
  const mottle = fbm(size, 4, 5, rand);
  const fiber = fbm(size, 8, 3, rand);
  const white = whiteNoise(size, rand);

  const px = new Uint8Array(size * size * 2);
  let sum = 0;
  for (let i = 0; i < size * size; i++) {
    const w = white[i];
    let v = k.speckle * w * w;
    v += k.pooling * smoothstep(0.52, 0.95, mottle[i]);
    v += k.fiber * smoothstep(0.62, 0.98, fiber[i]) * w;
    if (w > 0.994) v += 0.5; // hard flecks
    const a = clamp(v, 0, k.cap);
    sum += a;
    px[i * 2] = k.gray;
    px[i * 2 + 1] = Math.round((a * 255) / 4) * 4; // quantised — compresses far better
  }
  return { size, px, stat: `mottle ${((sum / (size * size)) * 100).toFixed(1)}%` };
}

/* ---------- film: the full-viewport pass over the whole page ---------- */

const FILM = {
  size: 384,
  seed: 481207,
  light: 62, // peak alpha of the bright speckle
  dark: 74, // peak alpha of the dark speckle
  motesPer: 1700, // one hard mote per N pixels
  scratches: 5,
  floor: 9, // alpha below this snaps to nothing — keeps the file small
  quant: 8, // ditto: fewer alpha levels compress much better
};

function film(k = FILM) {
  const { size } = k;
  const rand = rng(k.seed);
  const mottle = fbm(size, 3, 4, rand); // some stretches dirtier than others
  const fiber = fbm(size, 16, 3, rand);
  const w1 = whiteNoise(size, rand);
  const w2 = whiteNoise(size, rand);

  const gray = new Uint8Array(size * size).fill(255);
  const alpha = new Float32Array(size * size);

  for (let i = 0; i < size * size; i++) {
    const density = 0.55 + 0.85 * smoothstep(0.35, 0.85, mottle[i]);
    const light = w1[i] * w1[i];
    const dark = w2[i] * w2[i] * w2[i];
    if (dark * 1.4 > light) {
      gray[i] = 0;
      alpha[i] = dark * k.dark * density;
    } else {
      gray[i] = 255;
      alpha[i] = (light * k.light + 0.18 * k.light * smoothstep(0.7, 1, fiber[i])) * density;
    }
  }

  // scratches read as light — dust caught in the beam, not gouges in the ink
  const scratch = scratchField(size, k.scratches, rand);
  for (let i = 0; i < alpha.length; i++) {
    if (scratch[i] <= 0) continue;
    gray[i] = 255;
    alpha[i] = Math.max(alpha[i], scratch[i] * 70);
  }

  // hard motes — the specks you actually notice
  specks(size, Math.round((size * size) / k.motesPer), rand, 0.6, 2.4, (idx, dist) => {
    gray[idx] = 0;
    alpha[idx] = Math.max(alpha[idx], 150 * (1 - smoothstep(0.5, 1, dist)));
  });

  const px = new Uint8Array(size * size * 2);
  let sum = 0;
  for (let i = 0; i < size * size; i++) {
    let a = Math.round(clamp(alpha[i], 0, 255) / k.quant) * k.quant;
    if (a < k.floor) {
      a = 0;
      gray[i] = 255; // flat runs where nothing shows — cheap to compress
    }
    sum += a;
    px[i * 2] = gray[i];
    px[i * 2 + 1] = a;
  }
  return { size, px, stat: `coverage ${((sum / (size * size) / 255) * 100).toFixed(1)}%` };
}

/* ---------- write ---------- */

function save(name, tex) {
  const png = encodePng(tex.size, tex.px);
  writeFileSync(join(ROOT, "public", name), png);
  console.log(
    `${name.padEnd(10)} ${tex.size}²  ${(png.length / 1024).toFixed(1).padStart(6)} KB   ${tex.stat}`
  );
}

/** Flattens alpha into a visible gray so the texture can be eyeballed. */
function savePreview(dir, name, tex) {
  mkdirSync(dir, { recursive: true });
  const flat = new Uint8Array(tex.px.length);
  for (let i = 0; i < tex.size * tex.size; i++) {
    flat[i * 2] = tex.px[i * 2 + 1];
    flat[i * 2 + 1] = 255;
  }
  writeFileSync(join(dir, name), encodePng(tex.size, flat));
}

for (const [name, tex] of [
  ["dirt.png", dirt()],
  ["grain.png", grain()],
  ["film.png", film()],
]) {
  save(name, tex);
  if (process.env.PREVIEW) savePreview(process.env.PREVIEW, name.replace(".png", "-preview.png"), tex);
}
