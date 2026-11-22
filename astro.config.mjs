import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// 部署地址：GitHub Actions 里通过环境变量 SITE / BASE 注入（见 .github/workflows/deploy.yml）
export default defineConfig({
  site: process.env.SITE || 'https://example.com',
  base: process.env.BASE || '/',
  trailingSlash: 'ignore',
  integrations: [mdx()],
  devToolbar: { enabled: false },
  markdown: { shikiConfig: { theme: 'github-dark-dimmed' } },
});
