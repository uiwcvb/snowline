#!/usr/bin/env node
// ============================================================
//  WHITEOUT 博客命令行 —— 给 dsv4.1（以及人类）用的写作接口
//  用法见 AGENTS.md；`node scripts/blog.mjs help` 查看简表
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml';
import { postSchema, noteSchema, statusSchema, profileSchema, homeSchema, FORBIDDEN_MDX, MDX_COMPONENTS, ACCENTS } from '../src/lib/schema.mjs';
import { checkPaths } from './guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const POSTS = P('src/content/posts'), NOTES = P('src/content/notes'), DATA = P('src/data'), UPLOADS = P('public/uploads');

// ---------- 参数解析 ----------
const argv = process.argv.slice(2);
const pos = [], opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) opt[k] = true; else { opt[k] = n; i++; } }
  else if (a === '-m') { opt.m = argv[++i]; }
  else pos.push(a);
}
const out = (o) => console.log(opt.json ? JSON.stringify(o, null, 2) : (typeof o === 'string' ? o : JSON.stringify(o, null, 2)));
const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };
const pad = (n) => String(n).padStart(2, '0');
const now = () => new Date();
const isoLocal = (d = now()) => {
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${off >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
};
const ymd = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const list = (v) => (v === undefined || v === true ? [] : String(v).split(/[,，]/).map((s) => s.trim()).filter(Boolean));
const readBody = () => {
  if (opt['body-file']) return fs.readFileSync(path.resolve(String(opt['body-file'])), 'utf8');
  if (opt.body && opt.body !== true) return String(opt.body).replace(/\\n/g, '\n');
  return null;
};

// ---------- frontmatter ----------
function parseFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: null, body: raw, error: '缺少 frontmatter（文件必须以 --- 开头）' };
  try { return { data: yaml.load(m[1]) ?? {}, body: m[2] }; } catch (e) { return { data: null, body: m[2], error: 'frontmatter YAML 语法错误：' + e.message.split('\n')[0] }; }
}
function writeFile(file, data, body) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const fm = yaml.dump(clean, { lineWidth: 200, quotingType: '"' }).trim();
  fs.writeFileSync(file, `---\n${fm}\n---\n\n${body.trim()}\n`, 'utf8');
}
const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
const slugOf = (f) => rel(f).replace(/^src\/content\/posts\//, '').replace(/\.(md|mdx)$/, '');

function allPosts() {
  return walk(POSTS).filter((f) => /\.mdx?$/.test(f)).map((f) => ({ file: f, slug: slugOf(f), ...parseFile(f) }));
}
function nextCode() {
  const n = allPosts().map((p) => /^LOG-(\d+)$/.exec(p.data?.code ?? '')?.[1]).filter(Boolean).map(Number);
  return `LOG-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')}`;
}
function slugify(s) {
  const a = String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return a.length >= 3 ? a.slice(0, 60) : '';
}

// ---------- 校验 ----------
function lintBody(body, isMdx) {
  const errs = [];
  if (!isMdx) return errs;
  const code = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const { re, msg } of FORBIDDEN_MDX) if (re.test(code)) errs.push(msg);
  const tags = [...code.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]);
  for (const t of new Set(tags)) if (!MDX_COMPONENTS.includes(t)) errs.push(`未知组件 <${t}>（可用：${MDX_COMPONENTS.join(', ')}）`);
  return errs;
}
function lintImages(text) {
  const errs = [];
  for (const m of text.matchAll(/\/uploads\/[^\s)"'`\]}]+/g)) {
    const f = path.join(ROOT, 'public', decodeURIComponent(m[0]));
    if (!fs.existsSync(f)) errs.push(`图片不存在：${m[0]}（先用 upload 命令放进 public/uploads/）`);
  }
  return errs;
}
const zerr = (r) => r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);

function check() {
  const problems = [];
  const add = (file, list) => list.forEach((m) => problems.push({ file: rel(file), problem: m }));
  const codes = new Map();
  for (const p of allPosts()) {
    if (p.error) { add(p.file, [p.error]); continue; }
    if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/.test(p.slug)) add(p.file, ['文件名只能用小写字母、数字和 -']);
    const r = postSchema.safeParse(p.data);
    if (!r.success) add(p.file, zerr(r));
    else if (r.data.code) { if (codes.has(r.data.code)) add(p.file, [`编号 ${r.data.code} 与 ${codes.get(r.data.code)} 重复`]); codes.set(r.data.code, rel(p.file)); }
    add(p.file, lintBody(p.body, p.file.endsWith('.mdx')));
    add(p.file, lintImages(p.body + JSON.stringify(p.data)));
    if (!p.file.endsWith('.mdx') && /<[A-Z][A-Za-z]+[\s/>]/.test(p.body.replace(/```[\s\S]*?```/g, ''))) add(p.file, ['.md 文件里写了组件标签：要用组件请把扩展名改成 .mdx']);
  }
  for (const f of walk(NOTES).filter((f) => f.endsWith('.md'))) {
    const n = parseFile(f);
    if (n.error) { add(f, [n.error]); continue; }
    const r = noteSchema.safeParse(n.data);
    if (!r.success) add(f, zerr(r));
    if (/<[A-Za-z]/.test(n.body)) add(f, ['动态（note）里不能写 HTML / 组件']);
    add(f, lintImages(n.body));
  }
  for (const [name, schema] of [['profile', profileSchema], ['home', homeSchema], ['status', statusSchema]]) {
    const f = path.join(DATA, name + '.json');
    try { const r = schema.safeParse(JSON.parse(fs.readFileSync(f, 'utf8'))); if (!r.success) add(f, zerr(r)); }
    catch (e) { add(f, ['JSON 解析失败：' + e.message]); }
  }
  try {
    const home = JSON.parse(fs.readFileSync(path.join(DATA, 'home.json'), 'utf8'));
    const slugs = new Set(allPosts().map((p) => p.slug));
    for (const s of home.pinned ?? []) if (!slugs.has(s)) add(path.join(DATA, 'home.json'), [`pinned 里的 "${s}" 找不到对应文章`]);
  } catch {}
  return problems;
}

// ---------- 命令 ----------
const cmds = {
  help() {
    out(`WHITEOUT blog CLI
  new post "<标题>" [--slug s] [--tags a,b] [--accent ${ACCENTS.join('|')}] [--desc ".."] [--code LOG-012]
                    [--snow 0-1] [--fx calm|normal|max] [--intro ".."] [--seed ".."] [--cover /uploads/..]
                    [--mdx] [--draft] [--pinned] [--date YYYY-MM-DD] [--body "..."|--body-file f.md]
  new note "<内容>" [--mood ..] [--tags a,b]
  status [--doing ..] [--mood ..] [--listening ..] [--message ..]   （不带参数=查看）
  upload <本地文件> [--name xxx]        复制图片到 public/uploads/YYYY/MM/，输出可引用路径
  list [--json]                         列出所有文章
  check [--json]                        校验全部内容（构建前必须通过）
  publish [-m "说明"] [--no-push] [--dry]   check → build → guard → commit → push`);
  },

  new() {
    const kind = pos[1];
    if (kind === 'post') {
      const title = pos[2]; if (!title) die('需要标题：new post "标题"');
      const date = opt.date && opt.date !== true ? String(opt.date) : ymd();
      let slug = opt.slug && opt.slug !== true ? String(opt.slug) : slugify(title) || `${date}-${Math.random().toString(36).slice(2, 6)}`;
      const ext = opt.mdx ? 'mdx' : 'md';
      const file = path.join(POSTS, `${slug}.${ext}`);
      if (fs.existsSync(path.join(POSTS, `${slug}.md`)) || fs.existsSync(path.join(POSTS, `${slug}.mdx`))) die(`已存在：${slug}，换一个 --slug`);
      const data = {
        title, date, description: opt.desc && opt.desc !== true ? String(opt.desc) : title,
        tags: list(opt.tags), code: opt.code && opt.code !== true ? String(opt.code) : nextCode(),
        accent: opt.accent && opt.accent !== true ? String(opt.accent) : undefined,
        snow: opt.snow !== undefined ? Number(opt.snow) : undefined,
        fx: opt.fx && opt.fx !== true ? String(opt.fx) : undefined,
        intro: opt.intro && opt.intro !== true ? String(opt.intro) : undefined,
        seed: opt.seed && opt.seed !== true ? String(opt.seed) : undefined,
        cover: opt.cover && opt.cover !== true ? String(opt.cover) : undefined,
        draft: opt.draft ? true : undefined, pinned: opt.pinned ? true : undefined,
      };
      const r = postSchema.safeParse({ ...data, date: new Date(date) });
      if (!r.success) die('参数不符合契约：\n  ' + zerr(r).join('\n  '));
      writeFile(file, data, readBody() ?? '在这里写正文。');
      out({ ok: true, file: rel(file), slug, url: `/posts/${slug}/`, code: data.code });
    } else if (kind === 'note') {
      const text = pos[2] ?? readBody(); if (!text) die('需要内容：new note "内容"');
      const d = now();
      const file = path.join(NOTES, `${ymd(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.md`);
      const data = { date: isoLocal(d), mood: opt.mood && opt.mood !== true ? String(opt.mood) : undefined, tags: list(opt.tags) };
      const r = noteSchema.safeParse({ ...data, date: d });
      if (!r.success) die('参数不符合契约：\n  ' + zerr(r).join('\n  '));
      writeFile(file, data, text);
      out({ ok: true, file: rel(file) });
    } else die('new post | new note');
  },

  status() {
    const f = path.join(DATA, 'status.json');
    const cur = JSON.parse(fs.readFileSync(f, 'utf8'));
    const keys = ['doing', 'mood', 'listening', 'message'];
    if (!keys.some((k) => opt[k] !== undefined)) return out(cur);
    for (const k of keys) if (opt[k] !== undefined) cur[k] = opt[k] === true ? '' : String(opt[k]);
    cur.updated = isoLocal();
    const r = statusSchema.safeParse(cur);
    if (!r.success) die('不符合契约：\n  ' + zerr(r).join('\n  '));
    fs.writeFileSync(f, JSON.stringify(cur, null, 2) + '\n', 'utf8');
    out({ ok: true, status: cur });
  },

  upload() {
    const src = pos[1]; if (!src || !fs.existsSync(src)) die('upload <存在的本地文件>');
    const ext = path.extname(src).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'].includes(ext)) die('只接受图片：png jpg webp gif avif svg');
    if (fs.statSync(src).size > 5 * 1024 * 1024) die('图片超过 5MB，请先压缩');
    const d = now();
    const dir = path.join(UPLOADS, String(d.getFullYear()), pad(d.getMonth() + 1));
    fs.mkdirSync(dir, { recursive: true });
    const base = (opt.name && opt.name !== true ? String(opt.name) : path.basename(src, ext)).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'img';
    let name = base + ext, i = 1;
    while (fs.existsSync(path.join(dir, name))) name = `${base}-${++i}${ext}`;
    fs.copyFileSync(src, path.join(dir, name));
    const url = `/uploads/${d.getFullYear()}/${pad(d.getMonth() + 1)}/${name}`;
    out({ ok: true, path: url, markdown: `![](${url})` });
  },

  list() {
    const rows = allPosts().map((p) => ({ slug: p.slug, code: p.data?.code, date: p.data?.date instanceof Date ? ymd(p.data.date) : p.data?.date, title: p.data?.title, draft: !!p.data?.draft, tags: p.data?.tags ?? [] }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (opt.json) return out(rows);
    for (const r of rows) console.log(`${r.code ?? '--'}\t${r.date}\t${r.draft ? '[草稿] ' : ''}${r.title}\t(${r.slug})`);
  },

  check() {
    const p = check();
    if (opt.json) { out({ ok: !p.length, problems: p }); process.exit(p.length ? 1 : 0); }
    if (!p.length) return console.log('✓ 全部内容符合契约');
    for (const x of p) console.error(`✗ ${x.file}: ${x.problem}`);
    process.exit(1);
  },

  publish() {
    const sh = (c, o = {}) => execSync(c, { cwd: ROOT, stdio: 'inherit', ...o });
    const p = check();
    if (p.length) { for (const x of p) console.error(`✗ ${x.file}: ${x.problem}`); die('check 未通过，未发布'); }
    console.log('▸ 构建验证…');
    sh('npx astro build', { stdio: opt.json ? 'ignore' : 'inherit' });
    const changed = execSync('git status --porcelain --untracked-files=all', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
    if (!changed.length) return out({ ok: true, published: false, reason: '没有改动' });
    const bad = checkPaths(changed);
    if (bad.length) die('以下文件不在 agent 可写范围内，拒绝发布（请回滚或交给人类）：\n  ' + bad.join('\n  '));
    if (opt.dry) return out({ ok: true, dry: true, files: changed });
    sh('git add -- src/content src/data public/uploads');
    const msg = opt.m && opt.m !== true ? String(opt.m) : `content: ${changed.length} file(s) @ ${isoLocal()}`;
    sh(`git commit -m ${JSON.stringify(msg)}`);
    if (!opt['no-push']) sh('git push');
    out({ ok: true, published: true, files: changed, message: msg });
  },
};

(cmds[pos[0]] ?? cmds.help)();
