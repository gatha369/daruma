// クリア演出（第5章）の時間の流れ。画面表示とは切り離してある
// 1. 境内に120畳の和紙が敷かれる
// 2. 北斎が大筆で、眉間 → 鼻 → 目 → 顔の輪郭 → 衣 の順に描く（早回し）
// 3. 描き上がった絵が櫓に引き上げられ、風にはためく（見物人が喝采）
// 4. 「大だるま絵 完成」→ クリア画面が重なる

/** 描く順番（記録どおり） */
export const STROKE_ORDER = ['眉間', '鼻', '目', '顔の輪郭', '衣'] as const;
/** それぞれを描く時間（秒） */
export const STROKE_TIME = [0.7, 0.8, 1.6, 1.7, 2.1];
export const STROKE_GAP = 0.15; // 次の部分へ筆を運ぶ間
export const SHEET_TIME = 0.9; // 和紙が敷かれるまで
export const DRAW_START = SHEET_TIME + 0.2;
export const DRAW_END = DRAW_START + STROKE_TIME.reduce((a, b) => a + b, 0) + STROKE_GAP * (STROKE_TIME.length - 1);
export const LIFT_START = DRAW_END + 0.6; // 北斎が下がってから引き上げる
export const LIFT_TIME = 1.6;
export const TITLE_AT = LIFT_START + LIFT_TIME + 0.2; // 「大だるま絵 完成」
export const PANEL_AT = TITLE_AT + 1.2; // クリア画面
export const CLEAR_TOTAL = PANEL_AT;

export interface ClearState {
  sheet: number; // 和紙が敷かれた具合 0〜1
  strokes: number[]; // 各部分の描けた具合 0〜1（STROKE_ORDER の順）
  drawing: number; // いま描いている部分の番号（-1：描いていない）
  painter: boolean; // 北斎が絵の上にいるか
  lift: number; // 櫓への引き上げの具合 0〜1（なめらかに）
  flutter: boolean; // 風にはためいているか
  cheer: boolean; // 見物人の喝采
  title: boolean;
  panel: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/** 演出の開始から t 秒たったときの様子 */
export function clearState(t: number): ClearState {
  const strokes: number[] = [];
  let start = DRAW_START;
  let drawing = -1;
  STROKE_TIME.forEach((d, i) => {
    const k = clamp01((t - start) / d + 1e-9); // 足し算の誤差で、描き終わりが 0.9999… にならないように
    strokes.push(k);
    if (k > 0 && k < 1) drawing = i;
    start += d + STROKE_GAP;
  });
  const lift = ease(clamp01((t - LIFT_START) / LIFT_TIME));
  return {
    sheet: ease(clamp01(t / SHEET_TIME)),
    strokes,
    drawing,
    painter: t >= SHEET_TIME * 0.6 && t < DRAW_END + 0.4,
    lift,
    flutter: t >= LIFT_START + LIFT_TIME,
    cheer: lift > 0.5,
    title: t >= TITLE_AT,
    panel: t >= PANEL_AT,
  };
}
