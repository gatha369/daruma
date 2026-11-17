// 念珠の珠の並び方（達磨の足元で連なっていく輪と、達磨が手に掛けた念珠）
import { ROSARY_SIZE } from './sim';

export interface P3 { x: number; y: number; z: number }

/** 足元の輪（葉の形に合わせた楕円）。i 番目の珠の位置 */
export const FEET = { rx: 0.42, rz: 0.82, y: 0.1 };
export function feetBead(i: number): P3 {
  // 達磨の後ろ（カメラ側）から編み始め、ぐるりと一周で108個
  const a = Math.PI / 2 + (i / ROSARY_SIZE) * Math.PI * 2;
  return { x: Math.cos(a) * FEET.rx, y: FEET.y, z: Math.sin(a) * FEET.rz };
}

/** 達磨が手に掛けた念珠（体の前で斜めに掛かる輪） */
export const WORN = { r: 0.5, y: 0.42, tilt: 0.5 }; // 体（半径0.42）の外側に掛かる
export function wornBead(i: number): P3 {
  const a = Math.PI / 2 + (i / ROSARY_SIZE) * Math.PI * 2;
  const x = Math.cos(a) * WORN.r;
  const z0 = Math.sin(a) * WORN.r;
  // 前後方向に傾けて、手に掛けたように前（カメラ側）が下がる
  return { x, y: WORN.y - z0 * Math.sin(WORN.tilt), z: z0 * Math.cos(WORN.tilt) };
}

/** 完成の演出：足元の輪から手に掛けた位置へ、ふわりと持ち上がる（t：0〜1） */
export function liftBead(i: number, t: number): P3 {
  const a = feetBead(i);
  const b = wornBead(i);
  const k = t * t * (3 - 2 * t);
  const hop = Math.sin(Math.PI * t) * 0.35; // 途中で少し浮き上がる
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k + hop, z: a.z + (b.z - a.z) * k };
}
