import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema, noteSchema } from './lib/schema.mjs';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: postSchema,
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: noteSchema,
});

export const collections = { posts, notes };
