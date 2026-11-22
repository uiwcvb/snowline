/**
 * 生成式雪花晶体：同一个种子永远长出同一朵雪花。
 * 首页主视觉、文章封面、打字落雪、文章节点图标都用它。
 * 输出单位空间（半径 1）内的线段：[x1, y1, x2, y2, 层级, 出现时刻 0..1]
 */
export type Seg = [number, number, number, number, number, number];

export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 单条主臂（沿 +x），含对称分支 */
function arm(r: () => number, complexity: number): Seg[] {
  const out: Seg[] = [];
  out.push([0.06, 0, 1, 0, 0, 0]);
  const nb = 2 + Math.floor(r() * 2) + complexity;
  const ang = Math.PI / 3 + (r() - 0.5) * 0.25;
  for (let i = 0; i < nb; i++) {
    const t = 0.18 + (0.74 * (i + r() * 0.6)) / nb;
    const len = (0.12 + r() * 0.34) * (1.08 - t) * (i % 2 ? 0.8 : 1.15);
    const ex = t + Math.cos(ang) * len, ey = Math.sin(ang) * len;
    out.push([t, 0, ex, ey, 1, t]);
    out.push([t, 0, ex, -ey, 1, t]);
    if (complexity >= 2 && len > 0.12) {
      const sub = 1 + Math.floor(r() * complexity * 0.7);
      for (let k = 1; k <= sub; k++) {
        const s = k / (sub + 1);
        const bx = t + Math.cos(ang) * len * s, by = Math.sin(ang) * len * s;
        const l2 = len * (0.25 + r() * 0.25) * (1 - s * 0.5);
        out.push([bx, by, bx + l2, by, 2, t + s * 0.2]);
        out.push([bx, -by, bx + l2, -by, 2, t + s * 0.2]);
      }
    }
    if (r() < 0.35 && t < 0.7) {
      const w = 0.05 + r() * 0.05;
      out.push([t, w, t + w * 1.4, 0, 2, t]);
      out.push([t, -w, t + w * 1.4, 0, 2, t]);
    }
  }
  return out;
}

export function crystal(seed: string, complexity = 2, symmetry = 6): Seg[] {
  const r = rng(hash(seed));
  const a = arm(r, complexity);
  const out: Seg[] = [];
  const hexR = 0.1 + r() * 0.12;
  for (let k = 0; k < symmetry; k++) {
    const th = (k / symmetry) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    for (const [x1, y1, x2, y2, d, t] of a) {
      out.push([x1 * c - y1 * s, x1 * s + y1 * c, x2 * c - y2 * s, x2 * s + y2 * c, d, t]);
    }
    const th2 = ((k + 1) / symmetry) * Math.PI * 2;
    out.push([Math.cos(th) * hexR, Math.sin(th) * hexR, Math.cos(th2) * hexR, Math.sin(th2) * hexR, 1, 0.02]);
  }
  return out;
}

/** 生成 SVG path 字符串（文章封面、节点图标；服务端/客户端通用） */
export function crystalPath(seed: string, complexity = 2, size = 100) {
  const h = size / 2;
  return crystal(seed, complexity)
    .map(([x1, y1, x2, y2]) => `M${(h + x1 * h * 0.95).toFixed(1)} ${(h + y1 * h * 0.95).toFixed(1)}L${(h + x2 * h * 0.95).toFixed(1)} ${(h + y2 * h * 0.95).toFixed(1)}`)
    .join('');
}
