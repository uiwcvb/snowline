#!/usr/bin/env node
// 守门脚本：保证 agent 的提交只动内容，不动主题。
//   node scripts/guard.mjs <base-sha> <head-sha>   检查区间内所有 agent 作者的提交
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.agent-guard.json'), 'utf8'));

export function checkPaths(files) {
  return files.filter((f) => !cfg.allow.some((a) => (a.endsWith('/') ? f.startsWith(a) : f === a)));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'scripts/guard.mjs');
if (isMain) {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  const zero = !base || /^0+$/.test(base);
  const range = zero ? head : `${base}..${head}`;
  const git = (c) => execSync(`git ${c}`, { cwd: ROOT, encoding: 'utf8' }).trim();
  let shas = [];
  try { shas = git(`rev-list ${zero ? '-n 50 ' : ''}${range}`).split('\n').filter(Boolean); } catch { shas = git('rev-list -n 1 HEAD').split('\n'); }
  let bad = 0;
  for (const sha of shas) {
    const email = git(`show -s --format=%ae ${sha}`).toLowerCase();
    if (!cfg.agentEmails.map((e) => e.toLowerCase()).includes(email)) continue;
    const files = git(`show --name-only --format= ${sha}`).split('\n').filter(Boolean);
    const out = checkPaths(files);
    if (out.length) { bad++; console.error(`✗ ${sha.slice(0, 7)} (${email}) 改动了受保护路径：\n  ` + out.join('\n  ')); }
  }
  if (bad) process.exit(1);
  console.log(`✓ guard: ${shas.length} 个提交检查通过`);
}
