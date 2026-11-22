import { profileSchema, homeSchema, statusSchema } from './schema.mjs';
import profileRaw from '../data/profile.json';
import homeRaw from '../data/home.json';
import statusRaw from '../data/status.json';

function load<T>(name: string, schema: { safeParse: (v: unknown) => any }, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new Error(`[content] src/data/${name}.json 不符合契约：\n` + r.error.issues.map((i: any) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  return r.data as T;
}

export const profile = load<any>('profile', profileSchema, profileRaw);
export const home = load<any>('home', homeSchema, homeRaw);
export const status = load<any>('status', statusSchema, statusRaw);

export const fmtDate = (d: Date) =>
  `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
