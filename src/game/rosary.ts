// お助けアイテムの念珠（輪になった念珠）の形と、無敵中の七色の光
// 形（長岡の指示）：8〜10個ほどの玉が一つの輪になり、親玉に簡単な房が付いた簡略化した形
// ここでは玉9個＋親玉1つで輪を作る（親玉は輪の一つの位置を占める）

export interface P3 { x: number; y: number; z: number }

export const NENJU_BEADS = 9; // 輪の玉の数（親玉は別）
export const NENJU_RING = 0.5; // 輪の半径
export const NENJU_BEAD_R = 0.13; // 玉の大きさ（遠くからでも一つ一つ見える大きさ）
export const OYADAMA_R = 0.18; // 親玉の大きさ

/** 輪の上の位置（slot 0 が親玉、1〜NENJU_BEADS が玉）。水面と平行な輪で、親玉は手前＝カメラ側 */
function slot(k: number): P3 {
  const a = Math.PI / 2 + (k / (NENJU_BEADS + 1)) * Math.PI * 2;
  return { x: Math.cos(a) * NENJU_RING, y: 0, z: Math.sin(a) * NENJU_RING };
}

/** 輪の i 番目（0〜NENJU_BEADS-1）の玉の位置 */
export function nenjuBead(i: number): P3 {
  return slot(i + 1);
}

/** 親玉の位置 */
export function oyadamaPos(): P3 {
  return slot(0);
}

/** 七色（色相 0〜1）。時間とともに順にめぐる */
export function rainbowHue(t: number): number {
  return ((t * 0.9) % 1 + 1) % 1;
}

/**
 * 無敵中の光の強さ 0〜1。残り GLOW_WARN 秒からは点滅して、もうすぐ切れることがわかる
 * glowT：残り時間、warn：点滅を始める残り時間
 */
export function glowLevel(glowT: number, warn: number, t: number): number {
  if (glowT <= 0) return 0;
  if (glowT > warn) return 1;
  return Math.sin(t * Math.PI * 2 * 4) > 0 ? 1 : 0.15; // 1秒に4回の点滅
}
