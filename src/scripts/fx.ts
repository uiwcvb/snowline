import gsap from 'gsap';

const GLYPHS = '░▒▓█▚▞_-<>01#*';

/** 字符解码：乱码逐字锁定成原文 */
export function decode(el: HTMLElement, delay = 0) {
  const text = (el.dataset.text ??= el.textContent ?? '');
  const st = el as HTMLElement & { _tw?: gsap.core.Tween };
  st._tw?.kill();
  const o = { p: 0 };
  st._tw = gsap.to(o, {
    p: 1,
    duration: Math.min(1.2, 0.3 + text.length * 0.03),
    delay,
    ease: 'power2.out',
    onUpdate() {
      const n = Math.floor(o.p * text.length);
      let s = text.slice(0, n);
      for (let i = n; i < text.length; i++) {
        const c = text[i];
        s += c === ' ' || c === '\n' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = s;
    },
    onComplete() { el.textContent = text; },
  });
}

export function countUp(el: HTMLElement, delay = 0) {
  const to = Number(el.dataset.count ?? 0);
  const dec = Number(el.dataset.dec ?? 0);
  const o = { v: 0 };
  gsap.fromTo(o, { v: 0 }, {
    v: to, duration: 1.6, delay, ease: 'expo.out',
    onUpdate() { el.textContent = o.v.toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec }); },
    onComplete() { el.textContent = to.toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec }); },
  });
}
