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

// ---- 道のりに合わせた景色の変化（第7章）【仮】 ----
// 和紙の枚数（進み具合 0〜1）と連動して、名古屋城 → 堀川沿いの町並み → 西掛所 と移っていく

export type SceneName = 'castle' | 'town' | 'kakesho';
export const SCENE_LABEL: Record<SceneName, string> = { castle: '名古屋城', town: '堀川の町並み', kakesho: '西掛所' };

/** 場面の切り替わり（進み具合）。前後 FADE の幅でなめらかに移る */
export const SCENE_EDGES: [number, number] = [0.33, 0.66];
export const SCENE_FADE = 0.06;

const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a), 0, 1);

/** 各場面の濃さ 0〜1（合計はいつも1） */
export function sceneWeights(progress: number): Record<SceneName, number> {
  const p = clamp(progress, 0, 1);
  const [e1, e2] = SCENE_EDGES;
  const toTown = ramp(p, e1 - SCENE_FADE, e1 + SCENE_FADE);
  const toKakesho = ramp(p, e2 - SCENE_FADE, e2 + SCENE_FADE);
  return { castle: 1 - toTown, town: toTown - toKakesho, kakesho: toKakesho };
}

/** いちばん濃い場面 */
export function sceneAt(progress: number): SceneName {
  const w = sceneWeights(progress);
  return (Object.keys(w) as SceneName[]).reduce((a, b) => (w[b] > w[a] ? b : a));
}

/**
 * 西掛所の大屋根の近さ 0〜1。町並みの後半から遠くに見えはじめ、120枚目に向かって近づく
 * （0：まだ見えない、1：目の前）
 */
export function kakeshoApproach(progress: number): number {
  return ramp(clamp(progress, 0, 1), SCENE_EDGES[0] + 0.12, 1);
}

/** 川岸に置くもの */
export type BankThing = 'matsu' | 'yanagi' | 'kura' | 'machiya' | 'fune' | 'tsuiji' | 'none';

/** 場面ごとの、川岸に置くものの出やすさ */
const BANK_MIX: Record<SceneName, Partial<Record<BankThing, number>>> = {
  castle: { matsu: 0.5, yanagi: 0.2, kura: 0.1, none: 0.2 }, // お城の近く：石垣と松
  town: { kura: 0.3, machiya: 0.35, yanagi: 0.12, fune: 0.18, none: 0.05 }, // 蔵や町家、舟
  kakesho: { tsuiji: 0.55, matsu: 0.15, machiya: 0.1, yanagi: 0.1, none: 0.1 }, // お寺の築地塀
};

/** 進み具合に応じて、川岸に置くものを1つ選ぶ（r：0〜1の乱数） */
export function pickBankThing(progress: number, r: number): BankThing {
  const w = sceneWeights(progress);
  const mix = new Map<BankThing, number>();
  for (const s of Object.keys(w) as SceneName[]) {
    for (const [k, v] of Object.entries(BANK_MIX[s]) as [BankThing, number][]) mix.set(k, (mix.get(k) ?? 0) + v * w[s]);
  }
  let t = r * [...mix.values()].reduce((a, b) => a + b, 0);
  for (const [k, v] of mix) if ((t -= v) < 0) return k;
  return 'none';
}
