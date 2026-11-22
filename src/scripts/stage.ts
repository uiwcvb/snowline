/** 首页：滚动 → 旅程进度 → 相机；沿途章节像路标一样从远处飞来、穿过镜头 */
import { world, emit, bus } from './engine';
import { decode, countUp } from './fx';
import { toast } from './hud';

export function initStage() {
  const track = document.querySelector<HTMLElement>('[data-track]')!;
  const stops = [...document.querySelectorAll<HTMLElement>('[data-stop]')];
  const ticks = [...document.querySelectorAll<HTMLElement>('[data-tick]')];
  const marker = document.querySelector<HTMLElement>('[data-marker]');
  const seen = new Set<HTMLElement>();
  let lastY = scrollY, active: HTMLElement | null = null;

  const progress = () => {
    const max = Math.max(1, track.offsetHeight - innerHeight);
    return Math.max(0, Math.min(1, scrollY / max));
  };
  world.pTarget = world.p = progress();

  world.hooks.push((dt) => {
    world.pTarget = progress();
    const dy = scrollY - lastY; lastY = scrollY;
    if (dt > 0) world.velTarget = Math.max(-2.2, Math.min(2.2, world.velTarget * 0.6 + (dy / dt / innerHeight) * 0.22));
    const p = world.p;
    document.documentElement.style.setProperty('--p', p.toFixed(4));
    if (marker) marker.style.setProperty('--at', p.toFixed(4));

    let best: HTMLElement | null = null;
    for (const s of stops) {
      const a = Number(s.dataset.from), b = Number(s.dataset.to);
      const fade = Number(s.dataset.fade ?? 0.03);
      // 从远处飞近（缩放 0.55→1），停留，最后穿过镜头（放大 + 消散）
      let o = 0, sc = 1, ty = 0;
      if (p < a - fade || p > b + fade) o = 0;
      else if (p < a) { const t = (p - (a - fade)) / fade; o = t; sc = 0.55 + 0.45 * t; ty = (1 - t) * 30; }
      else if (p <= b) { o = 1; ty = -((p - a) / Math.max(0.001, b - a)) * 30; }
      else { const t = (p - b) / fade; o = 1 - t; sc = 1 + t * 1.6; ty = -30 - t * 20; }
      s.style.opacity = o.toFixed(3);
      s.style.transform = `translate3d(calc(var(--mx) * -10px), ${ty.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
      s.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      s.classList.toggle('live', o > 0.6);
      if (o > 0.6 && !best) best = s;
      if (o > 0.6 && !seen.has(s)) {
        seen.add(s);
        s.querySelectorAll<HTMLElement>('[data-decode]').forEach((el, k) => decode(el, k * 0.06));
        s.querySelectorAll<HTMLElement>('[data-count]').forEach((el, k) => countUp(el, k * 0.08));
      }
    }
    if (best !== active) {
      active = best;
      if (best) {
        const id = best.dataset.stop!;
        ticks.forEach((t) => t.classList.toggle('on', t.dataset.tick === id));
        document.documentElement.dataset.chapter = id;
        emit('whoosh');
      }
    }
  });

  // 路线条：点击刻度跳转到该章节
  const jump = (p: number) => {
    const max = Math.max(1, track.offsetHeight - innerHeight);
    scrollTo({ top: p * max, behavior: world.reduced ? 'auto' : 'smooth' });
  };
  ticks.forEach((t) => t.addEventListener('click', () => jump(Number(t.dataset.p))));
  document.querySelectorAll<HTMLElement>('[data-jump]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); jump(Number(a.dataset.jump)); }));

  // 越过山脊
  bus.addEventListener('crossed', () => toast('已越过山脊', `海拔 ${Math.round(2400 + world.cam.y * 9)} m · 下方是云海`));
}
