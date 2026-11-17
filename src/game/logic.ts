// ゲームの中身（画面表示とは切り離した計算部分）。テストしやすいように純粋な関数でまとめる。

export const RIVER_HALF_WIDTH = 5; // 葉が動ける左右の幅（中心から片側）
export const START_SPEED = 8; // 前進の初速（1秒あたりの距離）
export const MAX_SPEED = 20;
export const ACCEL = 0.12; // 1秒ごとに増える速さ
export const UNITS_PER_RI = 100; // 画面上の「1里」にあたるゲーム内の距離（仮）
export const KEY_TARGET_SPEED = 11; // キー押しっぱなしで目標位置が動く速さ
export const FOLLOW = 6; // 目標位置への寄りやすさ（大きいほど速く寄る）
export const DAMPING = 4; // 横すべりの減衰

export const LEAF_HIT_RADIUS = 0.35; // 葉の当たり判定（前後2つの円）
export const LEAF_HIT_OFFSET = 0.6; // 葉の中心から前後の円までの距離

export interface Rock {
  x: number;
  z: number; // 前方向の位置（距離）
  r: number; // 半径
}

export interface Player {
  x: number;
  vx: number;
  targetX: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 経過時間から前進の速さを求める */
export function speedAt(elapsed: number): number {
  return Math.min(MAX_SPEED, START_SPEED + ACCEL * elapsed);
}

/** 葉を目標位置へ「少し遅れて滑らかに」寄せる（ばねと減衰） */
export function stepPlayer(p: Player, dt: number): Player {
  const targetX = clamp(p.targetX, -RIVER_HALF_WIDTH, RIVER_HALF_WIDTH);
  const ax = (targetX - p.x) * FOLLOW * FOLLOW * 0.5 - p.vx * DAMPING;
  let vx = p.vx + ax * dt;
  let x = p.x + vx * dt;
  if (x < -RIVER_HALF_WIDTH) { x = -RIVER_HALF_WIDTH; vx = Math.max(0, vx); }
  if (x > RIVER_HALF_WIDTH) { x = RIVER_HALF_WIDTH; vx = Math.min(0, vx); }
  return { x, vx, targetX };
}

/** 葉（前後2つの円）が岩に当たっているか */
export function hitsRock(px: number, pz: number, rock: Rock): boolean {
  for (const off of [-LEAF_HIT_OFFSET, LEAF_HIT_OFFSET]) {
    const dx = rock.x - px;
    const dz = rock.z - (pz + off);
    const rr = rock.r + LEAF_HIT_RADIUS;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  return false;
}

export function hitsAny(px: number, pz: number, rocks: Rock[]): boolean {
  return rocks.some((r) => hitsRock(px, pz, r));
}

/** 距離を「里」の表記にする */
export function formatRi(distance: number): string {
  return (Math.max(0, distance) / UNITS_PER_RI).toFixed(1);
}

// ---- 岩の並び ----
// 一定間隔ごとに「列」を作り、各列には必ず通り抜けの隙間を1つ残す。
// 隙間の位置は前の列から移動できる範囲だけずらすので、必ずどこかに道がある。

export const ROW_SPACING = 14; // 列と列の前後の間隔
export const GAP_WIDTH = 3.2; // 通り抜けの隙間の幅（岩の縁から縁まで）
export const MAX_GAP_SHIFT = 4; // 列ごとに隙間がずれる最大量

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

export interface Row {
  z: number;
  gapX: number;
  rocks: Rock[];
}

/**
 * 1列分の岩を作る。
 * distance が小さいうちは岩をまばらにし、進むほど密にする。
 */
export function makeRow(z: number, prevGapX: number, distance: number, rng: Rng): Row {
  const lim = RIVER_HALF_WIDTH - GAP_WIDTH / 2;
  const gapX = clamp(prevGapX + (rng() * 2 - 1) * MAX_GAP_SHIFT, -lim, lim);
  // 進み具合 0〜1（約1500の距離で最大の密度）
  const level = clamp(distance / 1500, 0, 1);
  const fillChance = 0.25 + 0.55 * level;
  const rocks: Rock[] = [];
  // 川幅を1.6間隔の区画に分け、隙間にかからない区画にだけ岩を置く
  const step = 1.6;
  for (let cx = -RIVER_HALF_WIDTH; cx <= RIVER_HALF_WIDTH + 0.01; cx += step) {
    if (rng() > fillChance) continue;
    const r = 0.45 + rng() * 0.35;
    const x = cx + (rng() - 0.5) * 0.4;
    // 岩の縁が隙間に食い込むなら置かない
    if (Math.abs(x - gapX) < GAP_WIDTH / 2 + r) continue;
    rocks.push({ x, z: z + (rng() - 0.5) * 2, r });
  }
  return { z, gapX, rocks };
}
