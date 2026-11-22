/** 开场（启动读数）与页面切换（像素溶解） */
import gsap from 'gsap';
import { world, boom, emit } from './engine';
import { decode } from './fx';
import { visit } from './sense';

export function initTransitions() {
  const boot = document.querySelector<HTMLElement>('[data-boot]');
  const cover = document.querySelector<HTMLElement>('[data-cover]');
  const isHome = document.documentElement.dataset.mode === 'stage';
  const firstThisSession = !sessionStorage.getItem('sl.booted');

  const reveal = () => {
    boot?.classList.add('done');
    cover?.classList.add('out');
    world.flash = Math.max(world.flash, 0.5);
    emit('whoosh');
  };

  if (boot && isHome && firstThisSession && !world.reduced) {
    sessionStorage.setItem('sl.booted', '1');
    const pct = boot.querySelector<HTMLElement>('[data-boot-pct]')!;
    const lines = [...boot.querySelectorAll<HTMLElement>('[data-boot-line]')];
    const v = boot.querySelector<HTMLElement>('[data-boot-visit]');
    if (v) v.textContent = visit.count <= 1 ? 'FIRST BOARDING · 第一次登机' : `第 ${visit.count} 次登机 · WELCOME BACK`;
    boot.classList.add('on');
    const dur = visit.count <= 1 ? 2.0 : 0.9;
    lines.forEach((l, i) => setTimeout(() => { l.classList.add('on'); decode(l); }, (i / lines.length) * dur * 900));
    const o = { p: 0 };
    gsap.to(o, { p: 100, duration: dur, ease: 'steps(24)', onUpdate: () => { pct.textContent = String(Math.floor(o.p)).padStart(3, '0'); }, onComplete: () => setTimeout(reveal, 200) });
  } else {
    const intro = document.documentElement.dataset.intro;
    if (boot && intro) {
      boot.classList.add('on', 'brief');
      const l = boot.querySelector<HTMLElement>('[data-boot-intro]');
      if (l) { l.textContent = intro; decode(l); }
      setTimeout(reveal, 700);
    } else setTimeout(reveal, 50);
  }
  addEventListener('pageshow', (e) => { if (e.persisted) { cover?.classList.remove('in'); cover?.classList.add('out'); boot?.classList.add('done'); } });

  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.jump != null) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.protocol === 'mailto:' || (url.pathname === location.pathname && url.hash)) return;
    if (/\.(xml|json|txt)$/.test(url.pathname)) return;
    e.preventDefault();
    boom(e.clientX, e.clientY, 1.3);
    world.velTarget = 2;
    cover?.classList.remove('out'); cover?.classList.add('in');
    setTimeout(() => { location.href = url.href; }, world.reduced ? 0 : 520);
  });
}
