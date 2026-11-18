// 差し替えやすいように、文面とURLはここにまとめる
// （公開URLが決まったら SITE_URL だけ書き換えればよい。ページの共有用の設定にも反映される）
import { formatTime } from './game/logic';

/** ゲームの公開URL【仮】公開先が決まったら差し替える */
export const SITE_URL = 'https://example.com/hokusai-daruma/';

/** 長岡念珠店のサイト */
export const SHOP_URL = 'https://nagaokanenju.com';

/** タイトル画面の文面（3.1）。サブタイトル・一行説明は【仮】 */
export const GAME_TITLE = '北斎の大だるま';
export const SUBTITLE = '堀川をくだって西掛所へ';
export const HOW_TO = '左右に動かして和紙を120枚集め、北斎に大だるまを描いてもらおう';

/** 大だるまの由来の紹介文（5.3）【仮の文面：長岡が確認・修正する。西別院にも確認してもらう】 */
export const STORY_TEXT =
  '文化14年（1817年）、葛飾北斎はここ西掛所（いまの本願寺名古屋別院）の境内で、120畳もの紙に達磨大師の半身像を即興で描き、名古屋の人々を驚かせました。その絵は失われましたが、200年後の2017年、同じ境内で当時の記録をもとに再現されました。西別院では毎年この時期に、その大だるま絵が公開されています。';

/** ページのタイトル・説明文（検索やSNSで表示される文）【仮】 */
export const PAGE_TITLE = '北斎の大だるま ― 堀川をくだって西掛所へ';
export const PAGE_DESCRIPTION =
  '葛飾北斎が西掛所で120畳の大だるまを描いた出来事にちなむブラウザゲーム。和紙を120枚集めて、大だるま絵を完成させよう。';

/** リンクを貼ったときに出る画像（public/ogp.png。第9章ステップ6で新しい見た目で作り直す） */
export const OGP_IMAGE = 'ogp.png';

/** Xの投稿文（第6章）【仮：文面】【未決定：ハッシュタグ（西別院の了解を得てから確定）】 */
export const HASHTAGS = '#北斎の大だるま #西別院';
/** クリアしたとき */
export function shareTextClear(seconds: number): string {
  return `北斎の大だるま、120畳を集めて大だるま絵が完成！（${formatTime(seconds)}） ${HASHTAGS}`;
}
/** 途中で終わったとき */
export function shareTextPartial(washi: number): string {
  return `北斎の大だるま、${washi}畳まで集めました ${HASHTAGS}`;
}

/** Xの投稿画面のURL */
export function shareUrl(text: string, siteUrl = SITE_URL): string {
  const q = new URLSearchParams({ text, url: siteUrl });
  return `https://x.com/intent/post?${q.toString()}`;
}
