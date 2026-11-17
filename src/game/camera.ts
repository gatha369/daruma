// カメラの置き方：葉がどこにいても川幅全体（両岸の間）が画面に入り、前方の川がよく見えるようにする
import { PerspectiveCamera, Vector3 } from 'three';
import { BANK_X } from './logic';

export const CAM_HEIGHT = 8;
export const CAM_BACK = 10; // 葉の後ろへの距離
export const CAM_LOOK_AHEAD = 9; // 葉の前方のどこを見るか
const MARGIN_X = 0.94; // 画面の左右端からの余白（1が画面端）
const MIN_FOV = 38;
const MAX_FOV = 100;

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
    // 葉のすぐ後ろ（カメラに近いほど横に広がって見えるので、ここが一番きびしい）
    const left = project(cam, -(BANK_X + 0.3), 0, 1.6);
    const right = project(cam, BANK_X + 0.3, 0, 1.6);
    const leafBack = project(cam, 0, 0, 1.5);
    if (Math.abs(left.x) <= MARGIN_X && Math.abs(right.x) <= MARGIN_X && leafBack.y >= -0.9) return fov;
  }
  return MAX_FOV;
}
