// OGP画像（1200×630）の仮画像を作る：タイトル画面の霧の川と達磨に、題字「一葦渡江」を重ねて撮る
// 使い方：開発用サーバーを起動した状態で  node scripts/make-ogp.mjs [ゲームのURL]
// 長岡が作った画像に置き換えるときは、public/ogp.png を上書きするだけでよい（このスクリプトは使わない）
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

const url = process.argv[2] ?? 'http://127.0.0.1:5199/?q=2';
const out = fileURLToPath(new URL('../public/ogp.png', import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(url);
await page.waitForFunction(() => window.__game);
// ボタンや案内を隠し、題字だけを残す
await page.addStyleTag({ content: `
  #start-btn, #title .hint, #sound-btn, #shop-link { display: none !important; }
  .title-box { margin-top: -6vh !important; }
  #title h1 { font-size: 104px !important; }
  #title .yomi { font-size: 22px !important; margin-bottom: 0 !important; }
` });
await page.waitForTimeout(2500); // 達磨と霧が落ち着くまで待つ
await page.screenshot({ path: out });
await browser.close();
console.log('書き出しました:', out);
