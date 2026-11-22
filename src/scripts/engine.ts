/**
 * SNOWLINE 像素雪山引擎
 * 低分辨率帧缓冲 + Bayer 抖动 + 黑白蓝调色板。
 * 一台相机沿 z 轴一镜到底：舷窗 → 峡谷 → 爬升 → 越过山脊 → 云海 → 山顶。
 * 所有输入（滚动/鼠标/点击/打字/倾斜）只写 world，所有画面与 DOM 只读 world。
 */
import { hash, rng } from '../lib/crystal';

export const bus = new EventTarget();
export const emit = (type: string, detail?: unknown) => bus.dispatchEvent(new CustomEvent(type, { detail }));

export const world = {
  t: 0, dt: 1 / 60, fps: 60,
  p: 0, pTarget: 0,              // 旅程进度 0..1
  vel: 0, velTarget: 0,          // 滚动速度
  mx: 0, my: 0, tmx: 0, tmy: 0, px: -999, py: -999,
  tilt: null as number | null,
  energy: 0, shock: 0, storm: 0, wind: 0, flash: 0,
  speed: 0,                      // 相机前进速度（世界单位/秒）
  snow: 0.6, fxScale: 1, depth: 0, foxfire: 0,
  mode: 'stage' as 'stage' | 'read',
  read: 0, dim: 0,
  crossed: false,
  cam: { z: -30, y: 45, x: 0, hor: 0.55, roll: 0 },
  hooks: [] as ((dt: number) => void)[],
  reduced: false, mobile: false, pointerFine: true,
};

// ---------------- 调色板 ----------------
const u32 = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16); };
const RAMPS: Record<string, string[]> = {
  blue:   ['#000000', '#06112e', '#0f3192', '#2f6bff', '#9cc2ff', '#ffffff'],
  ice:    ['#000000', '#071527', '#14507e', '#4fb3ff', '#c4e4ff', '#ffffff'],
  cobalt: ['#000000', '#080b34', '#1a26a3', '#4152ff', '#aab1ff', '#ffffff'],
  white:  ['#000000', '#141414', '#3a3a3a', '#8a8a8a', '#d2d2d2', '#ffffff'],
};
let RAMP = RAMPS.blue.map(u32);
const WHITE = u32('#ffffff'), BLACK = u32('#000000');
export let ACCENT_HEX = RAMPS.blue[3];
export function setAccent(name: string) {
  const r = RAMPS[name] ?? RAMPS.blue;
  RAMP = r.map(u32); ACCENT_HEX = r[3];
}

const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);

// ---------------- 噪声 ----------------
let T = new Float32Array(1024);
let seedStr = '';
export function setSeed(s: string) {
  if (s === seedStr) return;
  seedStr = s;
  const r = rng(hash(s));
  T = new Float32Array(1024).map(() => r());
}
setSeed('snowline');
const n1 = (x: number) => { const i = Math.floor(x), f = x - i, a = T[i & 1023], b = T[(i + 1) & 1023]; return a + (b - a) * f * f * (3 - 2 * f); };
const h2 = (i: number, j: number) => T[((i * 374761393) ^ (j * 668265263)) >>> 22 & 1023];
const n2 = (x: number, y: number) => {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(i, j), b = h2(i + 1, j), c = h2(i, j + 1), d = h2(i + 1, j + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};
const ridged = (x: number) => { const v = 1 - Math.abs(n1(x) * 2 - 1); return v * v; };
const mountain = (x: number) => (ridged(x) * 0.5 + ridged(x * 2.1 + 9) * 0.28 + n1(x * 4.3 + 3) * 0.14 + n1(x * 9.1 + 7) * 0.08);
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---------------- 世界几何 ----------------
const SP = 34, AMP = 88;
let FAR = 560;
export const ZR = 900;          // 主山脊位置
export const ZEND = 1500;
export const pathX = (z: number) => Math.sin(z * 0.0045) * 70 + Math.sin(z * 0.0017 + 1) * 50;
function height(k: number, x: number) {
  const z = k * SP;
  const after = z > ZR + 40 ? 0.62 : 1;
  let h = mountain(x * 0.011 + k * 7.31) * AMP * after;
  h *= 0.16 + 0.84 * smooth(25, 175, Math.abs(x - pathX(z)));
  const g = Math.exp(-(((z - ZR) / 72) ** 2));
  if (g > 0.01) {
    const mx = pathX(ZR);
    h += g * (205 * Math.exp(-(((x - mx - 30) / 260) ** 2)) * (0.72 + 0.28 * mountain(x * 0.02 + 3)) + 270 * Math.exp(-(((x - mx - 150) / 72) ** 2)));
  }
  return h;
}

// ---------------- 相机关键帧（首页一镜到底） ----------------
type Key = [number, number][];
const K_Z: Key = [[0, -34], [0.1, 18], [0.6, ZR - 22], [0.67, ZR + 70], [1, ZEND]];
const K_Y: Key = [[0, 44], [0.1, 48], [0.3, 66], [0.45, 110], [0.56, 170], [0.62, 150], [0.7, 215], [0.86, 160], [1, 175]];
const K_H: Key = [[0, 0.56], [0.1, 0.5], [0.45, 0.55], [0.55, 0.6], [0.6, 0.36], [0.66, 0.3], [0.74, 0.4], [0.86, 0.46], [1, 0.52]];
const K_C: Key = [[0, 0], [0.6, 0], [0.68, 1], [1, 1]];
function key(k: Key, p: number) {
  if (p <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (p <= k[i][0]) { const [p0, v0] = k[i - 1], [p1, v1] = k[i]; const t = (p - p0) / (p1 - p0); return v0 + (v1 - v0) * t * t * (3 - 2 * t); }
  }
  return k[k.length - 1][1];
}

// ---------------- 画布状态 ----------------
let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, img: ImageData, buf: Uint32Array;
let LW = 0, LH = 0, PX = 3;
let occ: Int16Array, depthBuf: Float32Array, ridgeTop: Int16Array;
const PORT_END = 0.115;

// 3D 雪粒（相机坐标）
let NS = 0, sx: Float32Array, sy: Float32Array, sz: Float32Array, spx: Float32Array, spy: Float32Array;
function initSnow() {
  NS = Math.round((world.mobile ? 260 : 620) * (world.reduced ? 0.4 : 1));
  sx = new Float32Array(NS); sy = new Float32Array(NS); sz = new Float32Array(NS); spx = new Float32Array(NS).fill(-1); spy = new Float32Array(NS);
  for (let i = 0; i < NS; i++) respawn(i, Math.random() * 230 + 2);
}
function respawn(i: number, z = 230) { sx[i] = (Math.random() - 0.5) * 420; sy[i] = (Math.random() - 0.62) * 260; sz[i] = z; spx[i] = -1; }

// 2D 粒子（屏幕坐标，低分辨率）
type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: number; g: number };
const bits: Bit[] = [];
function spawn(x: number, y: number, vx: number, vy: number, life: number, c: number, g = 60) {
  if (bits.length > 900) bits.shift();
  bits.push({ x, y, vx, vy, life, max: life, c, g });
}
type Shock = { x: number; y: number; t0: number; p: number };
const shocks: Shock[] = [];
type Flake = { x: number; y: number; vy: number; vx: number; ph: number };
const flakes: Flake[] = [];

// 舷窗起雾（粗网格，鼠标可擦）
const FG_W = 64, FG_H = 36;
const fog = new Float32Array(FG_W * FG_H).fill(0.6);

// 狐狸（konkon 彩蛋）
let foxT0 = -99;
const FOX = [
  ['....X.X.......', '....XXX.......', 'X...XXXX......', 'XX.XXXXXXXXX..', '.XXXXXXXXXXXX.', '..XXXXXXXXXX..', '...X.X..X.X...', '..X...X.X...X.'],
  ['....X.X.......', '....XXX.......', 'X...XXXX......', 'XX.XXXXXXXXX..', '.XXXXXXXXXXXX.', '..XXXXXXXXXX..', '...X..X.X..X..', '...X..X.X..X..'],
];
const FLAKE = ['..X.X..', 'X..X..X', '.XXXXX.', 'XXX.XXX', '.XXXXX.', 'X..X..X', '..X.X..'];

// ---------------- 对外接口 ----------------
const toLow = (x: number, y: number) => [Math.floor(x / PX), Math.floor(y / PX)];
export function shockAt(cx: number, cy: number, p = 1) {
  const [x, y] = toLow(cx, cy);
  shocks.push({ x, y, t0: world.t, p });
  if (shocks.length > 5) shocks.shift();
  world.shock = Math.min(1.6, world.shock + 0.7 * p);
  world.energy = Math.min(1, world.energy + 0.5 * p);
}
export function boom(cx: number, cy: number, p = 1) {
  if (world.reduced) return;
  shockAt(cx, cy, p);
  const [x, y] = toLow(cx, cy);
  for (let k = 0; k < 50 * p; k++) {
    const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 120;
    spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, 0.5 + Math.random() * 0.8, Math.random() < 0.3 ? 3 : 5);
  }
  // 雪崩：点击所在列的山脊喷出雪烟
  const col = Math.max(0, Math.min(LW - 1, x));
  const top = ridgeTop[col];
  if (top > 2 && top < LH - 2) {
    for (let k = 0; k < 70 * p; k++) {
      const xx = col + (Math.random() - 0.5) * 40;
      const yy = ridgeTop[Math.max(0, Math.min(LW - 1, xx | 0))];
      spawn(xx, yy, (Math.random() - 0.3) * 30 + world.wind * 0.2, -10 - Math.random() * 40, 1 + Math.random() * 1.6, Math.random() < 0.5 ? 5 : 4, -6);
    }
  }
  wipeFog(cx, cy, 120);
  emit('crack', p);
}
export function typeFlake() {
  if (world.reduced) return;
  flakes.push({ x: Math.random() * LW, y: -8, vy: 14 + Math.random() * 18, vx: (Math.random() - 0.5) * 6, ph: Math.random() * 6 });
  if (flakes.length > 40) flakes.shift();
  world.energy = Math.min(1, world.energy + 0.05);
}
export function konkon() { world.foxfire = 9; foxT0 = world.t; shockAt(innerWidth / 2, innerHeight / 2, 1.2); emit('konkon'); }
export function wipeFog(cx: number, cy: number, r: number) {
  const gx = (cx / innerWidth) * FG_W, gy = (cy / innerHeight) * FG_H, rr = (r / innerWidth) * FG_W;
  for (let j = Math.max(0, (gy - rr) | 0); j < Math.min(FG_H, gy + rr + 1); j++)
    for (let i = Math.max(0, (gx - rr) | 0); i < Math.min(FG_W, gx + rr + 1); i++) {
      const d = Math.hypot(i - gx, (j - gy) * 1.0) / rr;
      if (d < 1) fog[j * FG_W + i] *= 0.35 + d * 0.65;
    }
}
export const frame = () => ({ LW, LH, PX });

// ---------------- 渲染 ----------------
function put(i: number, x: number, y: number, v: number, blue: boolean) {
  const b = B8[((y & 7) << 3) | (x & 7)];
  if (blue) { const f = v * 5; let idx = f | 0; if (f - idx > b) idx++; buf[i] = RAMP[idx > 5 ? 5 : idx < 0 ? 0 : idx]; }
  else buf[i] = v > b ? WHITE : BLACK;
}

function render() {
  const cam = world.cam;
  const cx = LW / 2 + (Math.random() - 0.5) * world.shock * 4;
  const horY = LH * cam.hor + world.my * LH * 0.05 + (Math.random() - 0.5) * world.shock * 4;
  const F = LH * 0.95 * (1 - Math.min(0.28, Math.abs(world.vel) * 0.14));
  const rollT = Math.tan(cam.roll);
  const dim = 1 - world.dim;
  FAR = Math.min(1500, 560 + Math.max(0, cam.y - 90) * 3.2);
  occ.fill(LH);
  depthBuf.fill(1e9);

  // ---- 山脊层：近 → 远，带遮挡 ----
  const k0 = Math.floor((cam.z + 3) / SP) + 1, kN = Math.floor((cam.z + FAR) / SP);
  for (let k = k0; k <= kN; k++) {
    const zk = k * SP, dz = zk - cam.z;
    if (dz < 3) continue;
    const sc = F / dz;
    const fogK = Math.pow(Math.min(1, dz / FAR), 1.15);
    const near = 1 - fogK;
    for (let x = 0; x < LW; x++) {
      const xs = x - cx, wx = xs / sc + cam.x;
      const h = height(k, wx);
      const hor = horY + xs * rollT;
      const top = hor - (h - cam.y) * sc;
      const y0 = Math.max(0, Math.ceil(top)), y1 = occ[x];
      if (y0 >= y1) continue;
      const slope = (height(k, wx + 2.5) - h) / 2.5;
      const lit = clamp01(0.62 - slope * 0.85);
      const cap = 6 + h * 0.4 + n1(wx * 0.07 + k * 3.1) * 16;
      const dir = slope > 0 ? 0.35 : -0.35;
      for (let y = y0; y < y1; y++) {
        const d = (y - top) / sc;
        let v: number, blue = true;
        const edge = cap * (0.7 + 0.6 * n1(wx * 0.09 + d * dir * 0.09 + k));
        if (d < edge) {
          v = (0.5 + 0.5 * lit) * (1 - 0.42 * clamp01(d / (cap * 1.4)));
          if (n1(wx * 0.35 + d * dir + k * 5) > 0.78) v *= 0.72;
          if (d * sc < 1.6) { v = 1; blue = false; }
        } else v = 0.04 + 0.13 * lit * n1(wx * 0.5 + d * 0.3);
        if (fogK > 0.02) { const s = 0.06 + 0.32 * smooth(LH * 0.75, 0, horY - y + LH * 0.1); v = v * near + s * fogK; blue = blue || fogK > 0.38; }
        const i = y * LW + x;
        put(i, x, y, v * dim, blue);
        depthBuf[i] = dz;
      }
      occ[x] = y0;
    }
  }
  ridgeTop.set(occ);

  // ---- 云海（越过山脊后出现） ----
  const cloud = world.mode === 'stage' ? key(K_C, world.p) : 0;
  if (cloud > 0.01 && cam.y > 112) {
    const Hc = 112;
    const yStart = Math.max(0, Math.ceil(horY + 1));
    for (let y = yStart; y < LH; y++) {
      for (let x = 0; x < LW; x++) {
        const hor = horY + (x - cx) * rollT;
        if (y <= hor + 0.5) continue;
        const dzc = (F * (cam.y - Hc)) / (y - hor);
        const i = y * LW + x;
        if (dzc > depthBuf[i] || dzc > FAR * 1.4) continue;
        const wx = ((x - cx) * dzc) / F + cam.x, wz = cam.z + dzc + world.t * 4;
        const n = n2(wx * 0.025, wz * 0.025) * 0.65 + n2(wx * 0.08 + 5, wz * 0.08) * 0.35;
        const dens = clamp01((n - 0.42 + (1 - cloud) * 0.6) * 4);
        if (dens <= 0) continue;
        const b = B8[((y & 7) << 3) | (x & 7)];
        if (dens < 0.6 && dens * 1.67 < b) continue;
        const fogK = Math.min(1, dzc / (FAR * 1.4));
        // 云顶受光：比较前方一点的密度，朝月一侧更亮
        const n2b = n2(wx * 0.025, (wz - 6) * 0.025) * 0.65 + n2(wx * 0.08 + 5, (wz - 6) * 0.08) * 0.35;
        const lit = clamp01(0.5 + (n - n2b) * 9);
        let v = (0.3 + 0.45 * lit + 0.2 * dens) * (1 - fogK * 0.45);
        const white = lit > 0.82 && fogK < 0.35;
        if (white) v = 1;
        put(i, x, y, v * dim, !white);
      }
    }
  }

  // ---- 天空、星、月 ----
  const moonX = LW * 0.7 - world.mx * LW * 0.02 - cam.x * 0.02, moonY = horY - LH * 0.3, moonR = LH * 0.12;
  const starShift = Math.floor(world.mx * 6 + cam.z * 0.02);
  for (let x = 0; x < LW; x++) {
    const yEnd = occ[x];
    for (let y = 0; y < yEnd; y++) {
      const i = y * LW + x;
      const hor = horY + (x - cx) * rollT;
      let v = 0.03 + 0.34 * smooth(LH * 0.8, 0, hor - y) * smooth(-LH * 0.2, LH * 0.05, hor - y + LH * 0.05);
      let blue = true;
      if (y > hor) { v = 0.22 + 0.16 * smooth(hor, hor + LH * 0.5, y); put(i, x, y, v * dim, true); continue; }
      const mdx = x - moonX, mdy = y - moonY, md = mdx * mdx + mdy * mdy;
      if (md < moonR * moonR) {
        const nx = mdx / moonR, ny = mdy / moonR, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lam = clamp01(nx * 0.55 - ny * 0.35 + nz * 0.76);
        const crater = n2(mdx * 0.22 + 40, mdy * 0.22) > 0.63 ? 0.22 : 0;
        v = lam > 0.1 ? 0.35 + lam * 0.6 - crater : 0.08 + crater * 0.3;
        blue = lam < 0.35;
      } else if (md < moonR * moonR * 1.7) {
        v += 0.12 * (1 - (Math.sqrt(md) - moonR) / (moonR * 0.3));
      } else if (v < 0.22) {
        const s = h2(x + starShift, y);
        if (s > 0.9965) { v = 0.6 + 0.4 * Math.sin(world.t * 3 + s * 999); blue = s < 0.9985; }
      }
      put(i, x, y, v * dim, blue);
    }
  }

  // ---- 3D 雪粒 ----
  const streak = world.speed > 70 || Math.abs(world.vel) > 0.6;
  const fall = 9 + world.storm * 14, drift = world.wind * 0.12;
  const dt = world.dt;
  for (let i = 0; i < NS; i++) {
    sz[i] -= (world.speed + 5) * dt;
    sy[i] += fall * dt * (0.6 + (i % 5) * 0.12);
    sx[i] += (drift + Math.sin(world.t * 0.8 + i) * 2) * dt;
    if (sz[i] < 1.5) { respawn(i); continue; }
    const s = F / sz[i];
    const X = cx + sx[i] * s, Y = horY + sy[i] * s + (sx[i] * s) * rollT;
    if (X < -40 || X > LW + 40 || Y < -40 || Y > LH + 40) { if (sz[i] < 60) respawn(i); else spx[i] = -1; continue; }
    const nearP = sz[i] < 40;
    const blue = sz[i] > 120;
    if (streak && spx[i] >= 0) line(spx[i] | 0, spy[i] | 0, X | 0, Y | 0, blue ? RAMP[3] : WHITE);
    else {
      dot(X | 0, Y | 0, blue ? RAMP[3] : WHITE);
      if (nearP) { dot((X | 0) + 1, Y | 0, WHITE); dot(X | 0, (Y | 0) + 1, WHITE); dot((X | 0) + 1, (Y | 0) + 1, WHITE); }
    }
    spx[i] = X; spy[i] = Y;
  }

  // ---- 2D 粒子 ----
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.life -= dt;
    if (b.life <= 0) { bits.splice(i, 1); continue; }
    b.vy += b.g * dt; b.vx += world.wind * 0.02 * dt; b.vx *= 0.985;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life / b.max > B8[((b.y & 7) << 3) | (b.x & 7)] * 0.8) dot(b.x | 0, b.y | 0, RAMP[b.c]);
  }

  // ---- 打字雪花 ----
  for (let i = flakes.length - 1; i >= 0; i--) {
    const f = flakes[i];
    f.y += f.vy * dt; f.x += (f.vx + Math.sin(world.t * 2 + f.ph) * 8 + world.wind * 0.05) * dt;
    if (f.y > LH + 10) { flakes.splice(i, 1); continue; }
    sprite(FLAKE, f.x | 0, f.y | 0, WHITE);
  }

  // ---- 冲击波（抖动圆环） ----
  for (let i = shocks.length - 1; i >= 0; i--) {
    const s = shocks[i], age = world.t - s.t0;
    if (age > 1.1) { shocks.splice(i, 1); continue; }
    const r = age * 240 * s.p, a = 1 - age / 1.1;
    const steps = Math.max(24, r * 6.3) | 0;
    for (let k = 0; k < steps; k++) {
      const t = (k / steps) * Math.PI * 2;
      for (let w = 0; w < 3; w++) {
        const x = (s.x + Math.cos(t) * (r - w)) | 0, y = (s.y + Math.sin(t) * (r - w)) | 0;
        if (B8[((y & 7) << 3) | (x & 7)] < a) dot(x, y, w === 0 ? WHITE : RAMP[3]);
      }
    }
  }

  // ---- 狐狸 ----
  if (world.foxfire > 0) {
    const age = world.t - foxT0, fx = (-20 + age * LW * 0.22) | 0;
    if (fx < LW + 20) {
      const col = Math.max(0, Math.min(LW - 1, fx + 7));
      const fy = Math.min(LH - 10, ridgeTop[col]) - 8;
      sprite(FOX[((world.t * 10) | 0) % 2], fx, fy, WHITE);
      for (let k = 0; k < 3; k++) spawn(fx + Math.random() * 4, fy + 4 + Math.random() * 3, -20 - Math.random() * 20, -15 - Math.random() * 20, 0.6 + Math.random() * 0.5, 3, -10);
    }
    if (Math.random() < 0.5) spawn(Math.random() * LW, LH + 2, (Math.random() - 0.5) * 10, -30 - Math.random() * 50, 1.5, 3, -5);
  }

  // ---- 舷窗（首页开场） ----
  if (world.mode === 'stage' && world.p < PORT_END + 0.01) cabin(cx, horY);

  // ---- 白化闪光 ----
  if (world.flash > 0.01) {
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) if (B8[((y & 7) << 3) | (x & 7)] < world.flash) buf[y * LW + x] = WHITE;
  }

  // ---- 速度撕裂：整行错位 ----
  const g = Math.min(1, Math.max(0, Math.abs(world.vel) - 0.5) * 0.9 + world.shock * 0.3);
  if (g > 0.05 && !world.reduced) {
    const bands = (2 + g * 8) | 0;
    for (let b = 0; b < bands; b++) {
      const y0 = (Math.random() * LH) | 0, hgt = 1 + ((Math.random() * 6 * g) | 0), off = ((Math.random() - 0.5) * 24 * g) | 0;
      for (let y = y0; y < Math.min(LH, y0 + hgt); y++) {
        const row = buf.subarray(y * LW, y * LW + LW);
        if (off > 0) row.copyWithin(off, 0, LW - off); else if (off < 0) row.copyWithin(0, -off);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function cabin(cx: number, cy: number) {
  const k = smooth(0, PORT_END, world.p);
  const e = k * k * (3 - 2 * k);
  const base = Math.min(LW, LH) * (world.mobile ? 0.4 : 0.34);
  const R = base + (Math.hypot(LW, LH) * 0.8 - base) * Math.pow(e, 1.5);
  const ring = Math.max(4, base * 0.16) * (1 + e * 3);
  const pcx = LW / 2 + world.mx * 6 * (1 - e), pcy = LH * 0.47 + world.my * 4 * (1 - e);
  const zoom = 1 + e * 3;
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      const dx = x - pcx, dy = y - pcy, d = Math.sqrt(dx * dx + dy * dy);
      const i = y * LW + x;
      if (d < R) {
        // 玻璃：边缘起雾 + 斜向反光
        const fg = fog[(((y / LH) * FG_H) | 0) * FG_W + (((x / LW) * FG_W) | 0)];
        const edge = clamp01((d / R - 0.6) / 0.4);
        const f = fg * edge * (1 - e);
        const q = dx + dy * 0.8 + R * 0.55;
        const band = (Math.abs(q) < R * 0.025 ? 0.14 : Math.abs(q - R * 0.09) < R * 0.008 ? 0.2 : 0) * (1 - e) * clamp01(1.2 - d / R);
        const a = f * 0.85 + band;
        if (a > 0.02 && B8[((y & 7) << 3) | (x & 7)] < a) put(i, x, y, band > 0 && f < 0.2 ? 0.85 : 0.75, f < 0.45);
        continue;
      }
      if (d < R + ring) {
        // 舷窗框：金属环，左上受光
        const t = (d - R) / ring;
        const ang = Math.atan2(dy, dx);
        const lit = clamp01(0.5 - Math.cos(ang + 0.8) * 0.45 * (t < 0.5 ? 1 : -1));
        let v = 0.18 + lit * 0.7;
        if (t < 0.12 || t > 0.9) v = 0.04;
        const bolt = Math.abs(((ang / (Math.PI * 2)) * 12 + 12) % 1 - 0.5) < 0.07 && Math.abs(t - 0.55) < 0.12;
        if (bolt) v = 1;
        put(i, x, y, v, !bolt && lit < 0.5);
        continue;
      }
      // 舱内：面板接缝、铆钉、窗外漏进来的蓝光
      const ux = (x - LW / 2) / zoom, uy = (y - LH / 2) / zoom;
      const seamY = Math.abs(((uy + 1000) % 44) - 22) > 21;
      const seamX = Math.abs(((ux + 1000) % 90) - 45) > 44;
      const rivet = Math.abs(((uy + 1000) % 44) - 6) < 1 && Math.abs(((ux + 1000) % 15) - 7) < 1;
      const spill = Math.exp(-(d - R - ring) / (base * 0.5)) * 0.35;
      let v = 0.05 + spill + (seamX || seamY ? -0.04 : 0) + (rivet ? 0.3 : 0);
      v += (n2(ux * 0.05, uy * 0.05) - 0.5) * 0.05;
      put(i, x, y, v, true);
    }
  }
}

function dot(x: number, y: number, c: number) { if (x >= 0 && y >= 0 && x < LW && y < LH) buf[y * LW + x] = c; }
function line(x0: number, y0: number, x1: number, y1: number, c: number) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx_ = x0 < x1 ? 1 : -1, sy_ = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  while (n++ < 80) { dot(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx_; } if (e2 <= dx) { err += dx; y0 += sy_; } }
}
function sprite(rows: string[], x: number, y: number, c: number) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === 'X') dot(x + i, y + j, c);
}

// ---------------- 主循环 ----------------
function resize() {
  world.mobile = innerWidth < 900 || matchMedia('(pointer: coarse)').matches;
  PX = world.mobile ? 3 : Math.max(3, Math.min(5, Math.round(innerWidth / 400)));
  LW = Math.ceil(innerWidth / PX); LH = Math.ceil(innerHeight / PX);
  canvas.width = LW; canvas.height = LH;
  img = ctx.createImageData(LW, LH);
  buf = new Uint32Array(img.data.buffer);
  occ = new Int16Array(LW); ridgeTop = new Int16Array(LW); depthBuf = new Float32Array(LW * LH);
  if (!NS) initSnow();
}

let started = false, last = 0, lastZ = 0;
export function startEngine(el: HTMLCanvasElement) {
  if (started) return;
  started = true;
  canvas = el;
  ctx = canvas.getContext('2d', { alpha: false })!;
  world.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  world.pointerFine = matchMedia('(pointer: fine)').matches;
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => {
    world.tmx = (e.clientX / innerWidth) * 2 - 1;
    world.tmy = (e.clientY / innerHeight) * 2 - 1;
    const d = world.px < -900 ? 0 : Math.hypot(e.clientX - world.px, e.clientY - world.py);
    world.px = e.clientX; world.py = e.clientY;
    world.energy = Math.min(1, world.energy + d * 0.0005);
    if (world.p < PORT_END) wipeFog(e.clientX, e.clientY, world.mobile ? 50 : 70);
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('input, textarea, [data-noboom]')) return;
    boom(e.clientX, e.clientY, 1);
  });

  const root = document.documentElement.style;
  const loop = (now: number) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    world.dt = dt; world.t += dt;
    world.fps += (1 / dt - world.fps) * 0.05;
    const k = (r: number) => 1 - Math.exp(-dt * r);
    world.p += (world.pTarget - world.p) * k(world.reduced ? 30 : 5);
    world.velTarget *= Math.exp(-dt * 4);
    world.vel += (world.velTarget - world.vel) * k(8);
    world.mx += (world.tmx - world.mx) * k(3);
    world.my += (world.tmy - world.my) * k(3);
    world.energy = Math.max(world.energy * Math.exp(-dt), Math.min(1, Math.abs(world.vel) * 0.9));
    world.shock *= Math.exp(-dt * 4);
    world.flash *= Math.exp(-dt * 2.2);
    if (world.foxfire > 0) world.foxfire = Math.max(0, world.foxfire - dt);
    for (const f of fog.keys()) fog[f] = Math.min(0.6, fog[f] + dt * 0.03);

    const cam = world.cam;
    if (world.mode === 'stage') {
      const p = world.p;
      cam.z = key(K_Z, p); cam.hor = key(K_H, p);
      let need = 0;
      const ka = Math.floor(cam.z / SP) + 1;
      for (let kk = ka; kk < ka + 3; kk++) need = Math.max(need, height(kk, cam.x) + 18 + (kk - ka) * 4);
      const ty = Math.max(key(K_Y, p), need);
      cam.y += (ty - cam.y) * (ty > cam.y ? k(9) : k(2.5));
    }
    const tz = pathX(cam.z + 60);
    cam.x += (tz + world.mx * 30 - cam.x) * k(3);
    const curve = (pathX(cam.z + 90) - pathX(cam.z + 30)) / 60;
    const rollT = -curve * 0.5 + world.mx * 0.05 + world.vel * 0.05 + (world.tilt ?? 0) * 0.25 + Math.sin(world.t * 0.6) * 0.01;
    cam.roll += (rollT - cam.roll) * k(3);
    world.speed = Math.max(0, (cam.z - lastZ) / dt) * 0.6 + world.speed * 0.4;
    lastZ = cam.z;

    // 越过山脊
    if (world.mode === 'stage') {
      if (!world.crossed && cam.z > ZR) { world.crossed = true; world.flash = 0.9; shockAt(innerWidth / 2, innerHeight * 0.5, 1.6); emit('crossed'); }
      if (world.crossed && cam.z < ZR - 60) world.crossed = false;
    }

    const stormT = Math.min(1, Math.abs(world.vel) * 0.55 + world.energy * 0.25 + (world.speed > 90 ? 0.2 : 0)) * world.fxScale;
    world.storm += (stormT - world.storm) * k(3);
    const windT = ((world.tilt ?? world.mx) * 60 + world.vel * 120) * (1 + world.storm * 2);
    world.wind += (windT - world.wind) * k(2);

    for (const h of world.hooks) h(dt);
    render();

    const sh = world.shock;
    root.setProperty('--mx', world.mx.toFixed(4));
    root.setProperty('--my', world.my.toFixed(4));
    root.setProperty('--vel', world.vel.toFixed(4));
    root.setProperty('--avel', Math.abs(world.vel).toFixed(4));
    root.setProperty('--energy', world.energy.toFixed(4));
    root.setProperty('--roll', (cam.roll * 57.3).toFixed(3) + 'deg');
    root.setProperty('--shx', (Math.round((Math.random() - 0.5) * sh * 6) * 2) + 'px');
    root.setProperty('--shy', (Math.round((Math.random() - 0.5) * sh * 6) * 2) + 'px');
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
