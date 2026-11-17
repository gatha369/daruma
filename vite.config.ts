import { defineConfig } from 'vite';
import { SITE_URL, PAGE_TITLE, PAGE_DESCRIPTION, OGP_IMAGE } from './src/config';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// index.html の %SITE_URL% などを、src/config.ts の値に置き換える（設定を1か所にまとめるため）
export default defineConfig({
  plugins: [{
    name: 'page-meta',
    transformIndexHtml(html) {
      return html
        .replaceAll('%PAGE_TITLE%', esc(PAGE_TITLE))
        .replaceAll('%PAGE_DESCRIPTION%', esc(PAGE_DESCRIPTION))
        .replaceAll('%SITE_URL%', esc(SITE_URL))
        .replaceAll('%OGP_IMAGE_URL%', esc(new URL(OGP_IMAGE, SITE_URL).href));
    },
  }],
});
