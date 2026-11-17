import { describe, it, expect } from 'vitest';
import { shareText, shareUrl, SHOP_URL, STORY_TEXT, SITE_URL, PAGE_TITLE } from '../src/config';

describe('共有と念珠店へのリンク（ステップ4）', () => {
  it('投稿文に距離と念珠の連数が入る（第6章の例のとおり）', () => {
    expect(shareText('12.3', 2)).toBe('一葦渡江で 12.3里 進み、念珠を2連 編みました #一葦渡江 #達磨大師');
  });

  it('Xの投稿画面のURLに、投稿文とゲームのURLが入る', () => {
    const u = new URL(shareUrl('4.0', 0));
    expect(u.origin + u.pathname).toBe('https://x.com/intent/post');
    expect(u.searchParams.get('text')).toBe(shareText('4.0', 0));
    expect(u.searchParams.get('url')).toBe(SITE_URL);
  });

  it('記号（#や空白）が壊れずに渡る', () => {
    const u = new URL(shareUrl('1.0', 1, 'https://a.example/?x=1&y=2'));
    expect(u.searchParams.get('text')).toContain('#一葦渡江 #達磨大師');
    expect(u.searchParams.get('url')).toBe('https://a.example/?x=1&y=2');
  });

  it('念珠店のURL・紹介文・ページタイトル', () => {
    expect(SHOP_URL).toBe('https://nagaokanenju.com');
    expect(STORY_TEXT).toContain('一葦渡江');
    expect(PAGE_TITLE).toBe('一葦渡江 ― 葦の葉に乗った達磨大師と長江を渡るブラウザゲーム｜長岡念珠店');
  });
});
