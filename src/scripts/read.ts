/** 文章页：阅读进度 = 沿着这篇文章专属的山脉前进 */
import { world } from './engine';

export function initRead() {
  const art = document.querySelector<HTMLElement>('[data-article]');
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  let lastY = scrollY;
  world.mode = 'read';
  world.dim = 0.15;
  const cam = world.cam;
  cam.y = 80; cam.hor = 0.52; cam.z = 60;
  world.hooks.push((dt) => {
    let p = 0;
    if (art) { const r = art.getBoundingClientRect(); p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight * 0.6))); }
    world.read = p;
    bar?.style.setProperty('--p', p.toFixed(4));
    const tz = 60 + p * 700 + world.t * 1.5;
    cam.z += (tz - cam.z) * Math.min(1, dt * 3);
    cam.y += (70 + p * 120 - cam.y) * Math.min(1, dt * 2);
    cam.hor += (0.52 + p * 0.06 - cam.hor) * Math.min(1, dt * 2);
    const dy = scrollY - lastY; lastY = scrollY;
    if (dt > 0) world.velTarget = Math.max(-2, Math.min(2, world.velTarget * 0.6 + (dy / dt / innerHeight) * 0.18));
  });

  // <Frost> 组件：擦开霜看内容
  document.querySelectorAll<HTMLElement>('[data-frost-box]').forEach((box) => {
    const cv = box.querySelector('canvas')!;
    const c = cv.getContext('2d')!;
    let cleared = 0, total = 1;
    const paint = () => {
      const r = box.getBoundingClientRect();
      cv.width = Math.ceil(r.width / 3); cv.height = Math.ceil(r.height / 3);
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        c.fillStyle = (x + y) % 2 === 0 || Math.random() < 0.3 ? '#ffffff' : '#9cc2ff';
        c.fillRect(x, y, 1, 1);
      }
      total = cv.width * cv.height; cleared = 0;
    };
    paint();
    const wipe = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * cv.width, y = ((e.clientY - r.top) / r.height) * cv.height;
      c.clearRect((x - 4) | 0, (y - 4) | 0, 9, 9);
      cleared += 40;
      if (cleared > total * 0.55) { cv.style.opacity = '0'; box.classList.add('clear'); }
    };
    cv.addEventListener('pointermove', wipe);
    cv.addEventListener('pointerdown', wipe);
  });
}
