// ============================================================
//  内容契约 —— 博客能接受的所有数据格式都定义在这里。
//  Astro 构建 和 `npm run blog -- check` 共用这一份校验。
//  dsv4.1 只能写符合契约的内容；主题本身不在契约之内。
// ============================================================
import { z } from 'astro/zod';

/** 可选强调色（只能从这里选，具体色值由主题决定） */
export const ACCENTS = ['blue', 'ice', 'cobalt', 'white'];
/** 首页一镜到底沿途的章节（顺序固定，跟着相机路线走） */
export const CHAPTERS = ['about', 'logs', 'feed', 'ridge', 'stats', 'summit'];

export const postSchema = z.object({
  title: z.string().min(1).max(80),
  date: z.coerce.date(),
  description: z.string().min(1).max(200),
  tags: z.array(z.string().min(1).max(16)).max(8).default([]),
  code: z.string().regex(/^[A-Z]{2,5}-\d{2,4}$/, '格式如 LOG-012').optional(),
  draft: z.boolean().default(false),
  pinned: z.boolean().default(false),
  accent: z.enum(ACCENTS).default('blue'),
  snow: z.number().min(0).max(1).default(0.5),
  fx: z.enum(['calm', 'normal', 'max']).default('normal'),
  cover: z.string().regex(/^\/uploads\/[\w\-./]+\.(png|jpe?g|webp|gif|avif|svg)$/i, '必须放在 /uploads/ 下').optional(),
  intro: z.string().max(60).optional(),
  seed: z.string().max(40).optional(),
}).strict();

export const noteSchema = z.object({
  date: z.coerce.date(),
  mood: z.string().max(12).optional(),
  tags: z.array(z.string().max(16)).max(5).default([]),
}).strict();

export const statusSchema = z.object({
  updated: z.string(),
  mood: z.string().max(16),
  doing: z.string().max(40),
  listening: z.string().max(60).optional(),
  message: z.string().max(80).optional(),
}).strict();

export const profileSchema = z.object({
  codename: z.string().regex(/^[A-Z0-9\-_.]{2,16}$/, '大写字母/数字，2-16 位'),
  name: z.string().max(20),
  role: z.string().max(40),
  tagline: z.string().max(60),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  oshiSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  about: z.array(z.string().max(160)).min(1).max(6),
  skills: z.array(z.object({ label: z.string().max(8), value: z.number().min(0).max(100) })).min(3).max(8),
  route: z.array(z.object({ year: z.string().max(8), title: z.string().max(10), text: z.string().max(40) })).min(2).max(8),
  email: z.string().email(),
  links: z.array(z.object({ label: z.string().max(12), href: z.string().url().or(z.string().regex(/^\/|^mailto:/)) })).max(6),
}).strict();

const chapter = z.object({ title: z.string().max(16), line: z.string().max(40) }).strict();
export const homeSchema = z.object({
  accent: z.enum(ACCENTS).default('blue'),
  mountain: z.object({ seed: z.string().min(1).max(40) }).strict(),
  hero: z.object({
    kicker: z.string().max(30),
    title: z.string().max(14),
    subtitle: z.string().max(30),
    cta: z.string().max(16),
  }).strict(),
  chapters: z.object(Object.fromEntries(CHAPTERS.map((c) => [c, chapter]))).strict(),
  hide: z.array(z.enum(['about', 'feed', 'stats'])).default([]),
  pinned: z.array(z.string()).max(3).default([]),
  bootLines: z.array(z.string().max(48)).max(8).default([]),
}).strict();

/** MDX 正文禁止出现的东西（防止 agent 绕过主题注入代码） */
export const FORBIDDEN_MDX = [
  { re: /^\s*(import|export)\s/m, msg: '不允许 import / export，组件已自动注入' },
  { re: /<script\b/i, msg: '不允许 <script>' },
  { re: /<style\b/i, msg: '不允许 <style>' },
  { re: /<iframe\b/i, msg: '不允许 <iframe>' },
  { re: /\bstyle=\{/, msg: '不允许内联 style 对象' },
  { re: /\bon[A-Z][a-zA-Z]+=\{/, msg: '不允许事件处理器' },
  { re: /\bdangerouslySetInnerHTML\b/, msg: '不允许 dangerouslySetInnerHTML' },
];

/** dsv4.1 允许使用的正文组件 */
export const MDX_COMPONENTS = ['Callout', 'Intel', 'Timeline', 'Step', 'Compare', 'Gallery', 'Danmaku', 'Stat', 'Chart', 'Frost', 'Crystal', 'Kbd'];
