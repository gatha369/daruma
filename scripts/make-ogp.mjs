// OGP画像（1200×630）を作る：タイトル画面（堀川・名古屋城・達磨）に、題字「北斎の大だるま」を重ねて撮る
// 使い方：開発用サーバーを起動した状態で  node scripts/make-ogp.mjs [ゲームのURL]
// 容量を小さく（目安300KB以下）するため JPEG で書き出す。長岡が作った画像に置き換えるときは public/ogp.jpg を上書きするだけでよい
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5199/?q=2';
const out = fileURLToPath(new URL('../public/ogp.jpg', import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(url);
await page.waitForFunction(() => window.__game);
// ボタンや案内を隠し、題字とサブタイトルだけを残す
await page.addStyleTag({ content: `
  #start-btn, #how-to, #sound-btn, .shop-link { display: none !important; }
  .title-box { margin-top: -14vh !important; }
  #title h1 { font-size: 100px !important; }
  #title .yomi { font-size: 26px !important; margin-bottom: 0 !important; }
` });
await page.waitForTimeout(2500); // 達磨と霧が落ち着くまで待つ
await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
await browser.close();
console.log('書き出しました:', out, `${Math.round(statSync(out).size / 1024)}KB`);
