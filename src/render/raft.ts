// 葦の葉（波でしなる）と達磨（傾き・転覆・起き上がり）、足元で編まれていく念珠
import * as THREE from 'three';
import { ROSARY_SIZE } from '../game/sim';
import { feetBead, liftBead, wornBead } from '../game/rosary';
import { toon, outlineMaterial } from './textures';

const LEAF_LEN = 1.3; // 葉の半分の長さ
const LEAF_W = 0.36; // 葉の半分の幅
const ROWS = 16;
const COLS = 4;
const BEAD_COLOR = 0x7b4a24; // 木の珠（仮）
const ROSARY_TIME = 1.4; // 念珠を手に掛ける演出の長さ

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
  private feet: THREE.InstancedMesh; // 足元の珠
  private lifting: THREE.InstancedMesh; // 完成の演出中に持ち上がる珠
  private worn: THREE.InstancedMesh; // 手に掛けた念珠
  private oyadama: THREE.Group; // 親珠と房
  private feetCount = -1;
  private rosaryT = -1; // 演出の進み（-1：演出なし）
  private hasWorn = false;
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

    // ---- 達磨：丸い体に朱の衣、輪郭に墨の線 ----
    const bodyGeo = new THREE.SphereGeometry(0.42, 28, 18);
    const body = new THREE.Mesh(bodyGeo, toon(0xc0392b));
    body.scale.set(1, 1.1, 1);
    body.position.y = 0.45;
    this.daruma.add(body);
    const bodyLine = new THREE.Mesh(bodyGeo, outlineMaterial);
    bodyLine.scale.set(1.06, 1.16, 1.06);
    bodyLine.position.y = 0.45;
    this.daruma.add(bodyLine);
    this.outlines.push(bodyLine);
    // 顔（進行方向を向いているので、ふだんは背中側が見える）
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.21, 24), toon(0xf2e6d0));
    face.position.set(0, 0.56, -0.415);
    face.rotation.y = Math.PI;
    this.daruma.add(face);
    this.group.add(this.daruma);

    // ---- 念珠 ----
    const beadGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const beadMat = toon(BEAD_COLOR, { emissive: 0x24120a });
    this.feet = new THREE.InstancedMesh(beadGeo, beadMat, ROSARY_SIZE);
    this.feet.count = 0;
    this.group.add(this.feet);
    this.lifting = new THREE.InstancedMesh(beadGeo, beadMat, ROSARY_SIZE);
    this.lifting.visible = false;
    this.daruma.add(this.lifting);
    this.worn = new THREE.InstancedMesh(beadGeo, beadMat, ROSARY_SIZE);
    this.worn.visible = false;
    this.daruma.add(this.worn);
    const m = new THREE.Matrix4();
    for (let i = 0; i < ROSARY_SIZE; i++) {
      const p = feetBead(i);
      this.feet.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      const w = wornBead(i);
      this.worn.setMatrixAt(i, m.makeTranslation(w.x, w.y, w.z));
    }
    // 親珠（大きめの珠）と房
    this.oyadama = new THREE.Group();
    const oya = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), beadMat);
    this.oyadama.add(oya);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 10), toon(0x8e2a22));
    tassel.position.y = -0.2;
    this.oyadama.add(tassel);
    this.oyadama.visible = false;
    this.daruma.add(this.oyadama);
  }

  setOutlines(on: boolean) { this.outlines.forEach((o) => (o.visible = on)); }

  /** 足元の珠の数（拾った数だけ並ぶ） */
  setBeads(n: number) {
    if (n === this.feetCount) return;
    this.feetCount = n;
    this.feet.count = Math.min(ROSARY_SIZE, n);
  }

  /** 108個そろった瞬間：親珠と房が付き、達磨が念珠を手に掛ける */
  startRosary() {
    this.rosaryT = 0;
    this.lifting.visible = true;
    this.lifting.count = ROSARY_SIZE;
    this.worn.visible = false;
    this.oyadama.visible = true;
  }

  get rosaryPlaying() { return this.rosaryT >= 0; }

  reset() {
    this.rosaryT = -1;
    this.hasWorn = false;
    this.worn.visible = false;
    this.lifting.visible = false;
    this.oyadama.visible = false;
    this.feetCount = -1;
    this.lean = 0;
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

    // 念珠を手に掛ける演出
    if (this.rosaryT >= 0) {
      this.rosaryT += dt / ROSARY_TIME;
      const k = Math.min(1, this.rosaryT);
      const m = new THREE.Matrix4();
      for (let i = 0; i < ROSARY_SIZE; i++) {
        const b = liftBead(i, k);
        this.lifting.setMatrixAt(i, m.makeTranslation(b.x, b.y, b.z));
      }
      this.lifting.instanceMatrix.needsUpdate = true;
      const front = liftBead(0, k); // 親珠は編み始め（カメラ側）の位置に付く
      this.oyadama.position.set(front.x, front.y - 0.02, front.z + 0.05);
      this.oyadama.scale.setScalar(Math.min(1, k * 2));
      if (k >= 1) {
        this.rosaryT = -1;
        this.lifting.visible = false;
        this.worn.visible = true;
        this.hasWorn = true;
      }
    }
  }

  get darumaLean() { return this.lean; }
  get wearing() { return this.hasWorn; }
}
