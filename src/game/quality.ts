// 重い端末向けの自動調整（第8章）：滑らかに動かないときは、見た目を段階的に軽くする

export type Level = 0 | 1 | 2; // 0：軽い　1：ふつう　2：きれい

export interface QualitySettings {
  pixelRatio: number; // 画面のきめ細かさの上限
  waterDetail: number; // 水面の波紋の細かさ（重ねる回数）
  mist: boolean; // 漂う霧の帯
  outlines: boolean; // 墨の輪郭線
  wake: boolean; // 航跡
}

export const SETTINGS: Record<Level, QualitySettings> = {
  0: { pixelRatio: 1, waterDetail: 1, mist: false, outlines: false, wake: true },
  1: { pixelRatio: 1.5, waterDetail: 2, mist: true, outlines: true, wake: true },
  2: { pixelRatio: 2, waterDetail: 4, mist: true, outlines: true, wake: true },
};

export const TARGET_FPS = 50; // これを下回り続けたら軽くする（目安60コマ、最低30コマ）
export const WINDOW = 2; // 何秒分の平均で判断するか
export const SETTLE = 1; // 切り替え直後に様子を見る秒数

export class QualityController {
  private frames = 0;
  private elapsed = 0;
  private settle = SETTLE;

  constructor(public level: Level) {}

  /**
   * 1コマごとに呼ぶ。軽くした場合は新しい段階を返す（変わらなければ null）。
   * 一度軽くしたら戻さない（行ったり来たりしてチラつかないように）
   */
  frame(dt: number): Level | null {
    if (dt <= 0 || dt > 0.25) return null; // 別のタブにいた等の飛びは数えない
    if (this.settle > 0) { this.settle -= dt; return null; }
    this.frames += 1;
    this.elapsed += dt;
    if (this.elapsed < WINDOW) return null;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    if (fps < TARGET_FPS && this.level > 0) {
      this.level = (this.level - 1) as Level;
      this.settle = SETTLE;
      return this.level;
    }
    return null;
  }
}

/** 最初の段階：スマホ・タブレットは「ふつう」から、PCは「きれい」から始める */
export function initialLevel(isTouchDevice: boolean): Level {
  return isTouchDevice ? 1 : 2;
}
