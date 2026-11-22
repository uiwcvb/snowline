/** 访客感知：回访记忆、离开补雪、手机倾斜、打字落雪、konkon */
import { world, typeFlake, konkon, emit } from './engine';
import { toast } from './hud';

export const visit = { count: 1, start: Date.now() };

export function initSense() {
  if (!sessionStorage.getItem('sl.session')) {
    sessionStorage.setItem('sl.session', '1');
    localStorage.setItem('sl.visits', String(Number(localStorage.getItem('sl.visits') || 0) + 1));
  }
  visit.count = Number(localStorage.getItem('sl.visits') || 1);
  world.depth = Number(sessionStorage.getItem('sl.depth') || 0);
  visit.start = Date.now() - Number(sessionStorage.getItem('sl.stay') || 0);
  addEventListener('pagehide', () => {
    sessionStorage.setItem('sl.depth', String(world.depth));
    sessionStorage.setItem('sl.stay', String(Date.now() - visit.start));
  });

  // 停留越久，雪越大
  world.hooks.push((dt) => {
    if (document.hidden) return;
    world.depth += (dt / 60) * 0.8 * (0.5 + world.snow);
  });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (!hiddenAt) return;
    const mins = (Date.now() - hiddenAt) / 60000;
    hiddenAt = 0;
    if (mins < 0.25) return;
    const cm = Math.min(30, mins * 1.5);
    world.depth += cm;
    world.flash = Math.min(0.6, 0.15 + mins * 0.05);
    toast(`你离开了 ${mins < 1 ? Math.round(mins * 60) + ' 秒' : Math.round(mins) + ' 分钟'}`, `山上又落了 ${cm.toFixed(1)} cm 雪`);
  });

  // 手机倾斜 = 相机侧倾 + 风向
  addEventListener('deviceorientation', (e) => { if (e.gamma != null) world.tilt = Math.max(-1, Math.min(1, e.gamma / 40)); });
  const DOE = (window as any).DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') addEventListener('touchend', () => DOE.requestPermission().catch(() => {}), { once: true });

  // 打字落雪 + konkon
  let buf = '';
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    typeFlake();
    buf = (buf + e.key.toLowerCase()).slice(-12);
    if (buf.endsWith('konkon')) { buf = ''; fox(); }
  });
  const brand = document.querySelector('.brand');
  let lp = 0;
  brand?.addEventListener('touchstart', () => { lp = window.setTimeout(fox, 1200); }, { passive: true });
  brand?.addEventListener('touchend', () => clearTimeout(lp));
  emit('ready');
}

function fox() {
  konkon();
  const since = document.documentElement.dataset.oshi;
  const days = since ? Math.floor((Date.now() - new Date(since).valueOf()) / 86400000) : 0;
  toast('こんこんきーつね！', days ? `白狐出没 · 第 ${days} 天` : '白狐出没');
}
