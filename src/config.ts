// 差し替えやすいように、文面とURLはここにまとめる
// （公開URLが決まったら SITE_URL だけ書き換えればよい。ページの共有用の設定にも反映される）

/** ゲームの公開URL【仮】公開先が決まったら差し替える */
export const SITE_URL = 'https://example.com/ichii-tokou/';

/** 長岡念珠店のサイト */
export const SHOP_URL = 'https://nagaokanenju.com';

/** 結果画面の逸話の紹介文【仮の文面：長岡が確認・修正する】 */
export const STORY_TEXT =
  '達磨大師は、梁の武帝との問答ののち、一本の葦の葉に乗って長江を渡り、北の魏へ向かったと伝えられます。この「一葦渡江」の姿は、禅画の題材として今も描き継がれています。';

/** ページのタイトル・説明文（検索やSNSで表示される文）【仮】 */
export const PAGE_TITLE = '一葦渡江 ― 葦の葉に乗った達磨大師と長江を渡るブラウザゲーム｜長岡念珠店';
export const PAGE_DESCRIPTION =
  '達磨大師を乗せた葦の葉を左右に操り、岩や渦をよけながら長江を渡る。珠を108個拾えば念珠が一連。ブラウザですぐ遊べる水墨画風のゲームです。';

/** リンクを貼ったときに出る画像（public/ogp.png。長岡が作った画像に置き換えてよい） */
export const OGP_IMAGE = 'ogp.png';

/** Xの投稿文【未決定：文面・ハッシュタグ】第6章の例のとおり */
export function shareText(ri: string, rosaries: number): string {
  return `一葦渡江で ${ri}里 進み、念珠を${rosaries}連 編みました #一葦渡江 #達磨大師`;
}

/** Xの投稿画面のURL */
export function shareUrl(ri: string, rosaries: number, siteUrl = SITE_URL): string {
  const q = new URLSearchParams({ text: shareText(ri, rosaries), url: siteUrl });
  return `https://x.com/intent/post?${q.toString()}`;
}
