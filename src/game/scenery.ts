// 景色の色や霧の具合
// 4.7：これまでの「霧→夕暮れ→月夜」のくり返しは外した。
// 道のりに合わせた景色の変化（名古屋城→町並み→西掛所）は第7章（ステップ6）で作る。
// それまでの仮として、和紙が集まるにつれて朝霧が少しずつ晴れていく
import { clamp } from './logic';

export type RGB = [number, number, number];

/** 景色ごとの色や霧の具合 */
export interface Palette {
  sky: RGB; // 背景（和紙）の色
  fog: RGB; // 霧の色
  fogNear: number;
  fogFar: number;
  water: RGB; // 水面の地の色
  ink: RGB; // 水面の波紋（墨）の色
  inkStrength: number; // 波紋の濃さ
  mountain: RGB; // 遠景の山のいちばん手前の色
  mist: number; // 漂う霧の帯の濃さ 0〜1
  light: number; // 明るさ
  sun: number; // 夕日の見え具合 0〜1
  moon: number; // 月の見え具合 0〜1
  dark: number; // 画面全体が暗い度合い 0〜1（文字を白くするかどうかに使う）
}

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/** 朝霧の堀川（はじめの景色） */
export const MORNING: Palette = {
  sky: hex(0xe9e6df), fog: hex(0xe9e6df), fogNear: 30, fogFar: 120,
  water: hex(0xd8d5cd), ink: hex(0x3a3835), inkStrength: 0.55,
  mountain: hex(0x8d8b86), mist: 1, light: 1, sun: 0, moon: 0, dark: 0,
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 進み具合（和紙の枚数／120、0〜1）に応じた景色。霧が晴れて遠くまで見えるようになる */
export function paletteAt(progress: number): Palette {
  const k = clamp(progress, 0, 1);
  return {
    ...MORNING,
    fogNear: mix(MORNING.fogNear, 55, k),
    fogFar: mix(MORNING.fogFar, 170, k),
    mist: mix(MORNING.mist, 0.45, k),
  };
}
