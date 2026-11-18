// 葦の葉（波でしなる）と達磨（傾き・転覆・起き上がり）、念珠の無敵中の七色の光
import * as THREE from 'three';
import { rainbowHue } from '../game/rosary';
import { toon, outlineMaterial, discTexture } from './textures';
import { robeTexture, darumaFaceTexture } from './inkTextures';

const LEAF_LEN = 1.3; // 葉の半分の長さ
const LEAF_W = 0.36; // 葉の半分の幅
const ROWS = 16;
const COLS = 4;
const BODY_COLOR = 0xc0392b; // 朱の衣
/**
 * 達磨の向き。0 なら顔が真後ろ（カメラの方）を向く。進む方向は画面の奥。
 * プレイ中に顔が見えるよう、振り返ってこちらを見ている向きにしている（少し斜め）
 */
export const FACE_YAW = 0.35;
/** 衣の形（半径, 高さ）。下が裾、上が頭巾のてっぺん */
const DARUMA_PROFILE: [number, number][] = [
  [0, 0], [0.4, 0.02], [0.47, 0.14], [0.47, 0.3], [0.42, 0.46], [0.36, 0.58],
  [0.34, 0.7], [0.32, 0.82], [0.25, 0.95], [0.14, 1.03], [0, 1.06],
];
const FACE_Y = 0.72; // 顔の中心の高さ
/** 衣の表面の、前（+z）側の位置 */
function faceZ(y: number): number {
  for (let i = 1; i < DARUMA_PROFILE.length; i++) {
    const [r1, y1] = DARUMA_PROFILE[i - 1];
    const [r2, y2] = DARUMA_PROFILE[i];
    if (y >= y1 && y <= y2) return r1 + ((y - y1) / (y2 - y1)) * (r2 - r1);
  }
  return 0.3;
}

/** 葉の形の幅（先がとがった細長い形） */
function leafHalfWidth(z: number) {
  const k = Math.abs(z) / LEAF_LEN;
  return LEAF_W * Math.pow(Math.max(0, 1 - k * k), 0.8);
}

export class Raft {
  group = new THREE.Group();
  daruma = new THREE.Group();
  private leafGeo: THREE.BufferGeometry;
  private leafBase: Float32Array;
  private outlines: THREE.Object3D[] = [];
  private bodyMat: THREE.MeshToonMaterial;
  private halo: THREE.Sprite; // 無敵中に達磨のまわりにまとう光
  private haloMat: THREE.SpriteMaterial;
  private glow = 0;
  private lean = 0;
  private prevVx = 0;

  constructor() {
    // ---- 葉：細長い格子を作り、毎コマ高さを波打たせる ----
    const pos: number[] = [];
    const idx: number[] = [];
    for (let r = 0; r <= ROWS; r++) {
      const z = -LEAF_LEN + (2 * LEAF_LEN * r) / ROWS;
      const w = leafHalfWidth(z);
      for (let c = 0; c <= COLS; c++) {
        const x = -w + (2 * w * c) / COLS;
        // 先が少し反り、中央の葉脈に沿って少しくぼむ
        const y = 0.12 * Math.pow(Math.abs(z) / LEAF_LEN, 3) + 0.04 * Math.pow(x / LEAF_W, 2);
        pos.push(x, y, z);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = r * (COLS + 1) + c;
        const b = a + COLS + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.leafGeo = new THREE.BufferGeometry();
    this.leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.leafGeo.setIndex(idx);
    this.leafGeo.computeVertexNormals();
    this.leafBase = new Float32Array(pos);
    const leaf = new THREE.Mesh(this.leafGeo, toon(0x4d5444, { side: THREE.DoubleSide }));
    this.group.add(leaf);
    // 葉脈（中央の細い線）
    const vein = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, LEAF_LEN * 1.7), new THREE.MeshBasicMaterial({ color: 0x2a2e25 }));
    vein.position.y = 0.03;
    this.group.add(vein);

    // ---- 達磨：頭巾をかぶった朱の衣の半身。顔はぎょろりとした目と髭（北斎の大だるまの顔つきに寄せる） ----
    // 衣の形（下が広く、頭巾で丸く閉じる）を回転させて作る
    const profile = DARUMA_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
    const bodyGeo = new THREE.LatheGeometry(profile, 32);
    this.bodyMat = toon(BODY_COLOR, { map: robeTexture() });
    const figure = new THREE.Group();
    figure.rotation.y = FACE_YAW;
    this.daruma.add(figure);
    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    figure.add(body);
    const bodyLine = new THREE.Mesh(bodyGeo, outlineMaterial);
    bodyLine.scale.set(1.06, 1.03, 1.06);
    figure.add(bodyLine);
    this.outlines.push(bodyLine);
    // 顔：頭巾の開いた所に、少しふくらんだ顔をはめる（+z 側が顔）
    // 円を前へふくらませた形（絵がゆがまないよう、模様は正面から貼る）
    const faceGeo = new THREE.CircleGeometry(1, 32, 0, Math.PI * 2);
    const fp = faceGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const r2 = fp.getX(i) ** 2 + fp.getY(i) ** 2;
      fp.setZ(i, 0.5 * (1 - r2));
    }
    faceGeo.computeVertexNormals();
    const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: darumaFaceTexture() }));
    face.scale.set(0.27, 0.28, 0.1);
    // 衣の表面より少し前に出し、上から見下ろすカメラの方へ少し上向きに傾ける
    face.position.set(0, FACE_Y, faceZ(FACE_Y) + 0.03);
    face.rotation.x = -0.45;
    figure.add(face);
    // 頭巾の縁（顔のまわりの墨の線）
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 28), outlineMaterial.clone());
    (rim.material as THREE.MeshBasicMaterial).side = THREE.FrontSide;
    rim.scale.set(0.29, 0.3, 0.3);
    rim.position.copy(face.position);
    rim.rotation.copy(face.rotation);
    figure.add(rim);
    this.group.add(this.daruma);

    // ---- 無敵中の光（ふだんは見えない） ----
    this.haloMat = new THREE.SpriteMaterial({
      map: discTexture(0.9), transparent: true, depthWrite: false, opacity: 0,
    });
    this.halo = new THREE.Sprite(this.haloMat);
    this.halo.scale.setScalar(1.9);
    this.halo.position.y = 0.6;
    this.halo.visible = false;
    this.daruma.add(this.halo);
  }

  setOutlines(on: boolean) { this.outlines.forEach((o) => (o.visible = on)); }

  /**
   * 念珠の無敵中：達磨が七色に光る（色が順にめぐる）。level は光の強さ 0〜1（切れる前は点滅）
   */
  setGlow(level: number, t: number) {
    this.glow = level;
    if (level <= 0) {
      this.bodyMat.color.setHex(BODY_COLOR);
      this.bodyMat.emissive.setHex(0x000000);
      this.halo.visible = false;
      return;
    }
    const h = rainbowHue(t);
    this.bodyMat.color.setHSL(h, 0.85, 0.55);
    this.bodyMat.emissive.setHSL(h, 0.9, 0.3 * level);
    this.halo.visible = true;
    this.haloMat.color.setHSL((h + 0.5) % 1, 1, 0.5);
    this.haloMat.opacity = 0.85 * level;
    this.halo.scale.setScalar(1.8 + Math.sin(t * 9) * 0.12);
  }

  get glowing() { return this.glow > 0; }

  reset() {
    this.lean = 0;
    this.setGlow(0, 0);
  }

  /**
   * 葉のしなり：波に合わせて前後に波打つ。bend は揺れの大きさ（大波のときに大きくなる）
   * 達磨の傾き：左右に動くと、体が遅れて反対側へ傾く（慣性）
   */
  animate(t: number, dt: number, vx: number, speed: number, bend: number) {
    const p = this.leafGeo.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    const amp = 0.035 + bend * 0.12 + Math.min(0.03, Math.abs(vx) * 0.006);
    for (let i = 0; i < arr.length; i += 3) {
      const z = this.leafBase[i + 2];
      const x = this.leafBase[i];
      const tip = Math.abs(z) / LEAF_LEN;
      arr[i + 1] = this.leafBase[i + 1]
        + amp * Math.sin(z * 2.6 - t * (4 + speed * 0.25)) * tip
        + amp * 0.4 * Math.sin(x * 9 + t * 3) * tip;
    }
    p.needsUpdate = true;
    this.leafGeo.computeVertexNormals();

    // 横方向の加速と逆に傾く（なめらかに追いつく）
    const ax = dt > 0 ? (vx - this.prevVx) / dt : 0;
    this.prevVx = vx;
    const target = THREE.MathUtils.clamp(-ax * 0.012, -0.35, 0.35) + THREE.MathUtils.clamp(vx * 0.03, -0.15, 0.15);
    this.lean += (target - this.lean) * Math.min(1, dt * 8);
  }

  get darumaLean() { return this.lean; }
}
