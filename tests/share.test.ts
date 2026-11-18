import { describe, it, expect } from 'vitest';
import {
  shareTextClear, shareTextPartial, shareUrl, SHOP_URL, STORY_TEXT, SITE_URL, PAGE_TITLE, PAGE_DESCRIPTION,
  GAME_TITLE, SUBTITLE, HOW_TO,
} from '../src/config';

describe('共有と表記（第6章）', () => {
  it('クリア時の投稿文に、かかった時間が入る', () => {
    expect(shareTextClear(185)).toBe('北斎の大だるま、120畳を集めて大だるま絵が完成！（3分05秒） #北斎の大だるま #西別院');
  });

  it('途中で終わったときの投稿文に、集めた枚数が入る', () => {
    expect(shareTextPartial(87)).toBe('北斎の大だるま、87畳まで集めました #北斎の大だるま #西別院');
  });

  it('Xの投稿画面のURLに、投稿文とゲームのURLが入り、記号が壊れない', () => {
    const text = shareTextPartial(3);
    const u = new URL(shareUrl(text));
    expect(u.origin + u.pathname).toBe('https://x.com/intent/post');
    expect(u.searchParams.get('text')).toBe(text);
    expect(u.searchParams.get('url')).toBe(SITE_URL);
    const u2 = new URL(shareUrl(text, 'https://a.example/?x=1&y=2'));
    expect(u2.searchParams.get('url')).toBe('https://a.example/?x=1&y=2');
  });

  it('タイトル・紹介文・ページの説明・念珠店のURL', () => {
    expect(GAME_TITLE).toBe('北斎の大だるま');
    expect(SUBTITLE).toBe('堀川をくだって西掛所へ');
    expect(HOW_TO).toContain('和紙を120枚');
    expect(PAGE_TITLE).toBe('北斎の大だるま ― 堀川をくだって西掛所へ');
    expect(PAGE_DESCRIPTION).toContain('120畳');
    expect(STORY_TEXT).toContain('文化14年（1817年）');
    expect(STORY_TEXT).not.toContain('一葦渡江');
    expect(SHOP_URL).toBe('https://nagaokanenju.com');
  });
});
