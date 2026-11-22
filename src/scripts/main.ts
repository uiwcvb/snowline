import { startEngine, setSeed, setAccent, world, emit } from './engine';
import { initSense, visit } from './sense';
import { initAudio, setAudio, audioOn } from './audio';
import { initHud, toast } from './hud';
import { initTransitions } from './transition';
import { initStage } from './stage';
import { initRead } from './read';
import { decode } from './fx';

const html = document.documentElement;
setSeed(html.dataset.seed || 'snowline');
setAccent(html.dataset.accent || 'blue');
world.snow = Number(html.dataset.snow ?? 0.6);
world.fxScale = ({ calm: 0.55, normal: 1, max: 1.35 } as Record<string, number>)[html.dataset.fx ?? 'normal'] ?? 1;
startEngine(document.querySelector<HTMLCanvasElement>('#world')!);
initSense();
initAudio();
initHud(visit);
initTransitions();
if (html.dataset.mode === 'stage') initStage(); else {
  initRead();
  document.querySelectorAll<HTMLElement>('[data-decode]').forEach((el, k) => decode(el, 0.3 + k * 0.05));
}
document.querySelector('[data-toggle-audio]')?.addEventListener('click', () => {
  setAudio(!audioOn());
  toast(audioOn() ? '风声 ON' : '风声 OFF', audioOn() ? '实时合成，越快风越大' : 'MUTED');
});
document.querySelector('[data-toggle-menu]')?.addEventListener('click', () => { html.classList.toggle('menu-open'); emit('hover'); });

// 顶栏在滚动后变实底，否则正文会从导航底下穿出来（手机端特别明显）
const nav = document.querySelector<HTMLElement>('.nav');
const syncNav = () => { nav?.classList.toggle('solid', window.scrollY > 24); };
syncNav();
window.addEventListener('scroll', syncNav, { passive: true });
