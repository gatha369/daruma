// 距離に応じた景色の移り変わり（4.5）：霧 → 夕暮れ → 月夜 をくり返す（仮）
import { clamp, smoothstep } from './logic';

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

export const STAGES: { name: string; palette: Palette }[] = [
  {
    name: '霧',
    palette: {
      sky: hex(0xe9e6df), fog: hex(0xe9e6df), fogNear: 30, fogFar: 120,
      water: hex(0xd8d5cd), ink: hex(0x3a3835), inkStrength: 0.55,
      mountain: hex(0x8d8b86), mist: 1, light: 1, sun: 0, moon: 0, dark: 0,
    },
  },
  {
    name: '夕暮れ',
    palette: {
      sky: hex(0xe8d6c0), fog: hex(0xe2c9ab), fogNear: 55, fogFar: 170,
      water: hex(0xd6c4ad), ink: hex(0x3d2f28), inkStrength: 0.6,
      mountain: hex(0x5e4e48), mist: 0.45, light: 0.9, sun: 1, moon: 0, dark: 0.1,
    },
  },
  {
    name: '月夜',
    palette: {
      sky: hex(0x2b2e35), fog: hex(0x2b2e35), fogNear: 40, fogFar: 150,
      water: hex(0x41454d), ink: hex(0xa9adb5), inkStrength: 0.45,
      mountain: hex(0x1b1d22), mist: 0.35, light: 0.55, sun: 0, moon: 1, dark: 1,
    },
  },
];

export const STAGE_LENGTH = 1000; // 1つの景色が続く距離（10里・仮）
export const TRANSITION = 200; // 次の景色へ移り変わる距離（2里）

/** いまの景色の番号と、次の景色への移り変わりの進み具合 0〜1 */
export function stageAt(distance: number): { from: number; to: number; t: number } {
  const d = Math.max(0, distance);
  const i = Math.floor(d / STAGE_LENGTH);
  const into = d - i * STAGE_LENGTH;
  const from = i % STAGES.length;
  const to = (i + 1) % STAGES.length;
  const t = smoothstep(clamp((into - (STAGE_LENGTH - TRANSITION)) / TRANSITION, 0, 1));
  return { from, to, t };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** 2つの景色の間をなめらかにつなぐ */
export function blendPalette(a: Palette, b: Palette, t: number): Palette {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(a) as (keyof Palette)[]) {
    const va = a[k];
    const vb = b[k];
    out[k] = Array.isArray(va) ? mixRGB(va as RGB, vb as RGB, t) : mix(va as number, vb as number, t);
  }
  return out as unknown as Palette;
}

export function paletteAt(distance: number): Palette {
  const { from, to, t } = stageAt(distance);
  const p = blendPalette(STAGES[from].palette, STAGES[to].palette, t);
  // 最初の「霧」は、進むにつれて少しずつ晴れていく
  if (from === 0 && t === 0) {
    const clear = clamp((distance % (STAGE_LENGTH * STAGES.length)) / (STAGE_LENGTH - TRANSITION), 0, 1);
    p.fogNear = mix(p.fogNear, 45, clear);
    p.fogFar = mix(p.fogFar, 150, clear);
    p.mist = mix(p.mist, 0.6, clear);
  }
  return p;
}
