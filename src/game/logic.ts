// ゲームの中身のうち、基本的な計算（画面表示とは切り離してある）

export const RIVER_HALF_WIDTH = 5; // 葉が動ける左右の幅（中心から片側）
export const BANK_X = RIVER_HALF_WIDTH + 1.2; // 川岸の目印の位置

// ---- 前進の速さ（4.2 / 4.5） ----
export const START_SPEED = 8; // 前進の初速（1秒あたりの距離）
export const MAX_SPEED = 18; // 速さの上限（人が反応できる範囲にとどめる）
export const CAP_DISTANCE = 3000; // この距離（30里）で速さ・難しさが上限に達する

export const UNITS_PER_RI = 100; // 画面上の「1里」にあたるゲーム内の距離（仮）

// ---- 左右の動き ----
export const KEY_TARGET_SPEED = 11; // キー押しっぱなしで目標位置が動く速さ
export const STIFFNESS = 18; // 目標位置へ引き寄せる強さ
export const DAMPING = 4; // 横すべりの減衰

// ---- 当たり判定 ----
export const LEAF_HIT_RADIUS = 0.35; // 葉の当たり判定（前後2つの円）
export const LEAF_HIT_OFFSET = 0.6; // 葉の中心から前後の円までの距離

export interface Player {
  x: number;
  vx: number;
  targetX: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** 進み具合 0〜1（CAP_DISTANCE で 1 になり、それ以上は増えない） */
export function difficultyAt(distance: number): number {
  return clamp(distance / CAP_DISTANCE, 0, 1);
}

/** 進んだ距離から前進の速さを求める（進むほど速くなり、上限で止まる） */
export function speedAt(distance: number): number {
  return START_SPEED + (MAX_SPEED - START_SPEED) * difficultyAt(distance);
}

export interface StepOptions {
  /** 外からの横向きの力（横向きの流れ・渦） */
  push?: number;
  /** 操作の効き具合 0〜1（大波を受けると下がる） */
  control?: number;
}

/** 葉を目標位置へ「少し遅れて滑らかに」寄せる（ばねと減衰） */
export function stepPlayer(p: Player, dt: number, opt: StepOptions = {}): Player {
  const control = opt.control ?? 1;
  const targetX = clamp(p.targetX, -RIVER_HALF_WIDTH, RIVER_HALF_WIDTH);
  const ax = (targetX - p.x) * STIFFNESS * control - p.vx * DAMPING * (0.5 + 0.5 * control) + (opt.push ?? 0);
  let vx = p.vx + ax * dt;
  let x = p.x + vx * dt;
  if (x < -RIVER_HALF_WIDTH) { x = -RIVER_HALF_WIDTH; vx = Math.max(0, vx); }
  if (x > RIVER_HALF_WIDTH) { x = RIVER_HALF_WIDTH; vx = Math.min(0, vx); }
  return { x, vx, targetX };
}

/** 葉の当たり判定の円（前後2つ）の中心 */
export function leafCircles(px: number, pz: number): [number, number][] {
  return [[px, pz - LEAF_HIT_OFFSET], [px, pz + LEAF_HIT_OFFSET]];
}

/** 点(x,z)と円が重なるか */
export function circleHit(px: number, pz: number, cx: number, cz: number, r: number): boolean {
  const dx = cx - px;
  const dz = cz - pz;
  return dx * dx + dz * dz < r * r;
}

/** 葉が円（岩など）に当たっているか */
export function leafHitsCircle(px: number, pz: number, cx: number, cz: number, r: number): boolean {
  return leafCircles(px, pz).some(([x, z]) => circleHit(x, z, cx, cz, r + LEAF_HIT_RADIUS));
}

/** 葉が横向きの棒（流木：中心 cx、半分の長さ half、太さ r）に当たっているか */
export function leafHitsLog(px: number, pz: number, cx: number, cz: number, half: number, r: number): boolean {
  return leafCircles(px, pz).some(([x, z]) => {
    const nx = clamp(x, cx - half, cx + half); // 棒の上で一番近い点
    return circleHit(x, z, nx, cz, r + LEAF_HIT_RADIUS);
  });
}

/** 距離を「里」の表記にする */
export function formatRi(distance: number): string {
  return (Math.max(0, distance) / UNITS_PER_RI).toFixed(1);
}

export type Rng = () => number;

/** 種を指定できる乱数（テスト用にも使う） */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
