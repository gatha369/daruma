// 堀川の川岸：石垣と、その上の土地に並ぶ松・柳・蔵・町家・舟・築地塀（第7章）
// 川岸を区切りごとに作り、後ろへ流れたものは前方へ回して作り直す。何を置くかは、その時の進み具合で決まる
import * as THREE from 'three';
import { BANK_X } from '../game/logic';
import { BankThing, pickBankThing } from '../game/scenery';
import { toon, outlineMaterial, mulberry } from './textures';
import { stoneWallTexture, groundTexture, tsuijiTexture, willowTexture } from './inkTextures';

/** 石垣の面（川側）の位置。葉が動ける範囲（±5）と当たり判定の外 */
export const WALL_X = BANK_X - 0.35;
export const WALL_TOP = 0.9; // 石垣の高さ（＝岸の地面の高さ）
const SEG = 10; // 区切りの長さ
const AHEAD = 170; // どこまで先に作るか
const BEHIND = 16; // どこまで後ろに残すか
const LONG = 400; // 石垣・地面の長さ（葉について動く）
const TILE = 8; // 石垣の模様1枚の長さ

interface Segment { index: number; groups: THREE.Group[] }

export class Riverside {
  group = new THREE.Group();
  private walls: THREE.Mesh[] = [];
  private grounds: THREE.Mesh[] = [];
  private segments: Segment[] = [];
  private outlinesOn = true;
  private geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    prism: prismGeometry(),
    trunk: new THREE.CylinderGeometry(0.07, 0.12, 1, 6),
    crown: new THREE.SphereGeometry(1, 10, 6),
    willow: new THREE.CylinderGeometry(0.35, 1, 1, 14, 1, true), // 垂れ下がる枝のすだれ
    hull: new THREE.BoxGeometry(1, 1, 1),
  };
  private mat = {
    pine: toon(0x3d463a),
    willow: new THREE.MeshToonMaterial({ map: willowTexture(), color: 0x7d8a6a, side: THREE.DoubleSide, transparent: true, alphaTest: 0.2 }),
    trunk: toon(0x4a4038),
    kuraWall: toon(0xf3efe6),
    namako: toon(0x3b3a38),
    roof: toon(0x3a3836),
    wood: toon(0x5a4c40),
    hull: toon(0x6b5a48),
    tsuiji: new THREE.MeshToonMaterial({ map: tsuijiTexture(), color: 0xffffff }),
  };

  constructor() {
    const wallTex = stoneWallTexture();
    wallTex.repeat.set(LONG / TILE, 1);
    const groundTex = groundTexture();
    groundTex.repeat.set(10, LONG / 8);
    const wallMat = new THREE.MeshBasicMaterial({ map: wallTex });
    const groundMat = new THREE.MeshBasicMaterial({ map: groundTex });
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(LONG, WALL_TOP + 0.4), wallMat);
      wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // 川の側を向く
      wall.position.set(side * WALL_X, (WALL_TOP - 0.4) / 2, 0);
      this.group.add(wall);
      this.walls.push(wall);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, LONG), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(side * (WALL_X + 40), WALL_TOP, 0);
      this.group.add(ground);
      this.grounds.push(ground);
    }
  }

  setOutlines(on: boolean) {
    this.outlinesOn = on;
    this.group.traverse((o) => { if (o.userData.outline) o.visible = on; });
  }

  /** はじめからやり直す（その進み具合の景色で作り直す） */
  reset(leafZ: number, progress: number) {
    for (const s of this.segments) for (const g of s.groups) this.group.remove(g);
    this.segments = [];
    this.update(leafZ, progress);
  }

  /** いまの何が置かれているか（確認用） */
  things(): BankThing[] {
    return this.segments.flatMap((s) => s.groups.map((g) => g.userData.kind as BankThing));
  }

  update(leafZ: number, progress: number) {
    // 石垣と地面は葉について動く。模様の1枚分ずつ動かして、模様が滑って見えないようにする
    const z = Math.round((leafZ - LONG / 2 + 40) / TILE) * TILE;
    for (const m of [...this.walls, ...this.grounds]) m.position.z = z;

    // 区切りの番号（前方ほど大きい。ワールドの z は前方ほど小さい）
    const first = Math.floor(-(leafZ + BEHIND) / SEG);
    const last = Math.floor(-(leafZ - AHEAD) / SEG);
    this.segments = this.segments.filter((s) => {
      if (s.index >= first && s.index <= last) return true;
      for (const g of s.groups) this.group.remove(g);
      return false;
    });
    const have = new Set(this.segments.map((s) => s.index));
    for (let i = first; i <= last; i++) {
      if (!have.has(i)) this.segments.push(this.build(i, progress));
    }
  }

  private build(index: number, progress: number): Segment {
    const groups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const rng = mulberry(index * 2 + (side > 0 ? 1 : 0) + 1000);
      const kind = pickBankThing(progress, rng());
      const g = this.make(kind, rng);
      g.userData.kind = kind;
      g.position.set(side * WALL_X, WALL_TOP, -(index * SEG + rng() * 2));
      if (side < 0) g.rotation.y = Math.PI; // 左岸は180度回して、外側が川から離れる向きになるように
      this.group.add(g);
      groups.push(g);
    }
    return { index, groups };
  }

  /** 墨の輪郭線つきの形 */
  private inked(geo: THREE.BufferGeometry, mat: THREE.Material, thick = 0.06): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    const line = new THREE.Mesh(geo, outlineMaterial);
    line.scale.setScalar(1 + thick);
    line.userData.outline = true;
    line.visible = this.outlinesOn;
    g.add(line);
    return g;
  }

  private part(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], scale: [number, number, number], thick = 0.06) {
    const p = this.inked(geo, mat, thick);
    p.position.set(...pos);
    p.scale.set(...scale);
    return p;
  }

  /** 柳の枝（すだれのような細い線。輪郭線は付けない） */
  private willow(pos: [number, number, number], scale: [number, number, number]) {
    const m = new THREE.Mesh(this.geo.willow, this.mat.willow);
    m.position.set(...pos);
    m.scale.set(...scale);
    return m;
  }

  /** 1つの区切りに置くもの。ローカル座標：x は川から離れる向き、y は地面の上、z は川に沿う向き */
  private make(kind: BankThing, rng: () => number): THREE.Group {
    const g = new THREE.Group();
    // ※ 右岸の向き（x＋が外側）で作る。左岸は build() で180度回して使う
    const out = (x: number) => x;
    switch (kind) {
      case 'matsu': {
        const h = 1.6 + rng() * 0.8;
        const x = out(0.8 + rng() * 1.5);
        const trunk = this.part(this.geo.trunk, this.mat.trunk, [x, h / 2, 0], [1, h, 1]);
        trunk.rotation.z = -0.25 + rng() * 0.2; // 川の方へ少し傾く
        g.add(trunk);
        // 平たい葉の固まりを段々に
        for (let i = 0; i < 3; i++) {
          const y = h * (0.55 + i * 0.22);
          const r = 0.9 - i * 0.2;
          g.add(this.part(this.geo.crown, this.mat.pine, [x - 0.3 + i * 0.15, y, (rng() - 0.5) * 0.4], [r, r * 0.32, r * 0.8]));
        }
        break;
      }
      case 'yanagi': {
        const h = 2.2 + rng() * 0.6;
        const x = out(0.6 + rng() * 0.8);
        g.add(this.part(this.geo.trunk, this.mat.trunk, [x, h / 2, 0], [1, h, 1]));
        g.add(this.willow([x, h * 0.62, 0], [0.9, h * 0.8, 0.9]));
        break;
      }
      case 'kura': {
        // 白壁の蔵（妻側を川に向ける）。腰は黒いなまこ壁
        const x = out(1.6 + rng() * 1.2);
        const len = 2.4 + rng() * 0.8;
        g.add(this.part(this.geo.box, this.mat.kuraWall, [x, 1.05, 0], [2.2, 2.1, len]));
        g.add(this.part(this.geo.box, this.mat.namako, [x, 0.35, 0], [2.26, 0.7, len + 0.06], 0.02));
        // 棟は川と直角の向き（三角柱を90度回す。回す前の z が長さ）
        const roof = this.part(this.geo.prism, this.mat.roof, [x, 2.1, 0], [len + 0.3, 0.7, 2.5]);
        roof.rotation.y = Math.PI / 2;
        g.add(roof);
        break;
      }
      case 'machiya': {
        // 低く長い町家。格子の前面と、川に沿って長い屋根
        const x = out(1.4 + rng() * 0.6);
        const len = 5 + rng() * 2;
        g.add(this.part(this.geo.box, this.mat.wood, [x, 0.7, 0], [2, 1.4, len]));
        g.add(this.part(this.geo.prism, this.mat.roof, [x, 1.4, 0], [1.5, 0.55, len + 0.3]));
        break;
      }
      case 'fune': {
        // 石垣のきわにつないだ舟（葉が通る範囲の外）と、そばの柳
        g.add(this.part(this.geo.hull, this.mat.hull, [-0.32, -WALL_TOP + 0.08, 0], [0.34, 0.16, 2.2], 0.08));
        g.add(this.part(this.geo.hull, this.mat.hull, [-0.32, -WALL_TOP + 0.14, 1.1], [0.2, 0.14, 0.3], 0.08)); // 反った舳先
        g.add(this.part(this.geo.trunk, this.mat.trunk, [-0.32, -WALL_TOP + 0.6, 0.6], [0.5, 1.1, 0.5])); // 竿
        g.add(this.part(this.geo.trunk, this.mat.trunk, [1, 1.1, 0], [1, 2.2, 1]));
        g.add(this.willow([1, 1.5, 0], [0.8, 1.8, 0.8]));
        break;
      }
      case 'tsuiji': {
        // 築地塀：白い壁に5本の横線、上に瓦の笠
        const x = out(0.9);
        const wall = new THREE.Mesh(this.geo.box, this.mat.tsuiji);
        wall.position.set(x, 0.8, 0);
        wall.scale.set(0.35, 1.6, SEG + 0.05);
        g.add(wall);
        g.add(this.part(this.geo.prism, this.mat.roof, [x, 1.6, 0], [0.8, 0.3, SEG + 0.3], 0.03));
        break;
      }
      default:
        break;
    }
    return g;
  }
}

/** 切妻屋根の形（三角柱。幅1・高さ1・長さ1、z方向に長い） */
function prismGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.5, 0);
  s.lineTo(0, 1);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  geo.translate(0, 0, -0.5);
  return geo;
}
