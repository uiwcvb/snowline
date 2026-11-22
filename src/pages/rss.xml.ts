import type { APIRoute } from 'astro';
import { getPosts } from '../lib/posts';
import { profile } from '../lib/data';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export const GET: APIRoute = async ({ site }) => {
  // BASE_URL 形如 '/' 或 '/snowline'，没有尾斜杠时 new URL 会把它当"文件"，相对链接会把最后一段吃掉
  const raw = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;
  const base = new URL(raw, site ?? 'https://example.com');
  const posts = await getPosts();
  const items = posts.map((p) => {
    const link = new URL(`posts/${p.id}/`, base).href;
    return `<item><title>${esc(p.data.title)}</title><link>${link}</link><guid>${link}</guid><pubDate>${p.data.date.toUTCString()}</pubDate><description>${esc(p.data.description)}</description></item>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(profile.codename)}</title><link>${base.href}</link><description>${esc(profile.tagline)}</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
