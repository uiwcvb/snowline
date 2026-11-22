/** 风雪环境音 + UI 音效：全部用 WebAudio 实时合成，没有音频文件。默认静音。 */
import { world, bus } from './engine';

let ac: AudioContext | null = null;
let windGain: GainNode, windFilter: BiquadFilterNode, master: GainNode;
let on = false;

function noiseBuffer(ctx: AudioContext, sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  return b;
}

function start() {
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
    windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.Q.value = 0.7; windFilter.frequency.value = 500;
    windGain = ac.createGain(); windGain.gain.value = 0;
    src.connect(windFilter).connect(windGain).connect(master);
    src.start();
    world.hooks.push(() => {
      if (!ac || !on) return;
      const s = world.storm, t = ac.currentTime;
      windFilter.frequency.setTargetAtTime(300 + s * 900 + Math.abs(world.wind) * 2 + Math.sin(world.t * 0.7) * 80, t, 0.3);
      windGain.gain.setTargetAtTime(0.05 + s * 0.35, t, 0.4);
    });
  }
  ac.resume();
}

export function setAudio(v: boolean) {
  on = v;
  localStorage.setItem('wo.audio', v ? '1' : '0');
  if (v) start(); else if (ac) windGain.gain.setTargetAtTime(0, ac.currentTime, 0.2);
  document.documentElement.dataset.audio = v ? 'on' : 'off';
}
export const audioOn = () => on;

function env(node: AudioNode, g: number, dur: number) {
  const gain = ac!.createGain();
  const t = ac!.currentTime;
  gain.gain.setValueAtTime(g, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(gain).connect(master);
}
function blip(freq: number, dur = 0.05, type: OscillatorType = 'square', g = 0.04, to?: number) {
  const o = ac!.createOscillator(); o.type = type; o.frequency.value = freq;
  if (to) o.frequency.exponentialRampToValueAtTime(to, ac!.currentTime + dur);
  env(o, g, dur); o.start(); o.stop(ac!.currentTime + dur + 0.02);
}
function hiss(dur: number, freq: number, g: number) {
  const s = ac!.createBufferSource(); s.buffer = noiseBuffer(ac!, 1);
  const f = ac!.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
  s.connect(f); env(f, g, dur); s.start(); s.stop(ac!.currentTime + dur + 0.02);
}

export function sfx(name: string) {
  if (!on || !ac) return;
  switch (name) {
    case 'crack': hiss(0.28, 2400, 0.35); blip(180, 0.25, 'sine', 0.2, 60); break;
    case 'hover': blip(2200, 0.03, 'square', 0.015); break;
    case 'click': blip(1400, 0.05, 'square', 0.03, 700); break;
    case 'whoosh': hiss(0.5, 600, 0.18); break;
    case 'thud': blip(90, 0.18, 'sine', 0.12, 50); break;
    case 'konkon': blip(880, 0.12, 'triangle', 0.08); setTimeout(() => blip(1320, 0.16, 'triangle', 0.08), 160); break;
    case 'alarm': blip(660, 0.12, 'sawtooth', 0.03); setTimeout(() => blip(660, 0.12, 'sawtooth', 0.03), 220); break;
  }
}

export function initAudio() {
  for (const n of ['crack', 'hover', 'whoosh', 'thud', 'konkon', 'alarm']) bus.addEventListener(n, () => sfx(n));
  const want = localStorage.getItem('wo.audio') === '1';
  document.documentElement.dataset.audio = 'off';
  if (want) addEventListener('pointerdown', () => setAudio(true), { once: true }); // 浏览器要求用户手势后才能出声
}
