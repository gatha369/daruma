// カメラの置き方：葉がどこにいても川幅全体（両岸の間）が画面に入り、前方の川がよく見えるようにする
import { PerspectiveCamera, Vector3 } from 'three';
import { BANK_X } from './logic';

export const CAM_HEIGHT = 9;
export const CAM_BACK = 13; // 葉の後ろへの距離
export const CAM_LOOK_AHEAD = 14; // 葉の前方のどこを見るか（地平線の上に遠景の山が見える程度）
const MARGIN_X = 0.94; // 画面の左右端からの余白（1が画面端）
const MIN_FOV = 38;
const MAX_FOV = 100;
const BEHIND = 3; // 葉の後ろをどこまで映すか

/** 画面の縦横比に合わせて、カメラを置いて向ける（葉の位置 leafZ はワールド座標） */
export function placeCamera(cam: PerspectiveCamera, aspect: number, leafZ: number, fov = fitFov(aspect)) {
  cam.aspect = aspect;
  cam.fov = fov;
  cam.position.set(0, CAM_HEIGHT, leafZ + CAM_BACK);
  cam.lookAt(0, 0, leafZ - CAM_LOOK_AHEAD);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

/** 点が画面上のどこに映るか（-1〜1） */
export function project(cam: PerspectiveCamera, x: number, y: number, z: number) {
  return new Vector3(x, y, z).project(cam);
}

/** 川幅全体と葉が収まる、いちばん狭い（＝前方がよく見える）視野角を求める */
export function fitFov(aspect: number): number {
  const cam = new PerspectiveCamera();
  for (let fov = MIN_FOV; fov <= MAX_FOV; fov += 0.5) {
    placeCamera(cam, aspect, 0, fov);
    // 葉の後ろ（航跡の始まり）まで映す。カメラに近いほど横に広がって見えるので、ここが一番きびしい
    const left = project(cam, -(BANK_X + 0.3), 0, BEHIND + 0.1);
    const right = project(cam, BANK_X + 0.3, 0, BEHIND + 0.1);
    const back = project(cam, 0, 0, BEHIND);
    if (Math.abs(left.x) <= MARGIN_X && Math.abs(right.x) <= MARGIN_X && back.y >= -0.95) return fov;
  }
  return MAX_FOV;
}
