import { world } from './engine';
import { decode } from './fx';

let toastEl: HTMLElement | null = null, timer = 0;
export function toast(title: string, sub = '') {
  toastEl ??= document.querySelector('[data-toast]');
  if (!toastEl) return;
  toastEl.querySelector('b')!.textContent = title;
  toastEl.querySelector('span')!.textContent = sub;
  toastEl.classList.add('show');
  decode(toastEl.querySelector('b')!);
  clearTimeout(timer);
  timer = window.setTimeout(() => toastEl!.classList.remove('show'), 4200);
}

export function initHud(visit: { count: number; start: number }) {
  const q = (k: string) => [...document.querySelectorAll<HTMLElement>(`[data-r="${k}"]`)];
  const set = (k: string, v: string) => q(k).forEach((el) => { if (el.textContent !== v) el.textContent = v; });
  set('visits', String(visit.count).padStart(3, '0'));
  let frame = 0;
  world.hooks.push(() => {
    if (++frame % 6) return;
    const c = world.cam;
    const stay = Math.floor((Date.now() - visit.start) / 1000);
    set('alt', String(Math.round(2400 + c.y * 9)).padStart(4, '0'));
    set('dist', Math.max(0, c.z * 0.012).toFixed(2));
    set('temp', (-6 - c.y * 0.045 - world.storm * 6).toFixed(1));
    set('wind', (Math.abs(world.wind) / 12 + world.storm * 18).toFixed(1));
    set('snow', world.depth.toFixed(1));
    set('stay', `${String(Math.floor(stay / 60)).padStart(2, '0')}:${String(stay % 60).padStart(2, '0')}`);
    set('clock', new Date().toTimeString().slice(0, 8));
    set('fps', world.fps.toFixed(0));
    set('pct', String(Math.round(world.p * 100)).padStart(3, '0'));
  });
}
