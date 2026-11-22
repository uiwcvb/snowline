import { getCollection } from 'astro:content';

export const u = (p: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + p;

export async function getPosts() {
  const all = await getCollection('posts', (p) => !p.data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
export async function getNotes() {
  const all = await getCollection('notes');
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
/** 中文按字、英文按词粗略计数 */
export const wordCount = (s = '') => (s.match(/[一-鿿]/g)?.length ?? 0) + (s.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0);
