// 3Dの表示。ゲームの状態（Sim）を受け取って、そのとおりに描く
import * as THREE from 'three';
import { BANK_X, RIVER_HALF_WIDTH, clamp } from '../game/logic';
import { Sim, CAPSIZE_TIME, WAVE_TIME, BEAD_RADIUS } from '../game/sim';
import { Bead, Log, Rock, Wave, Whirl, logX, waveZ } from '../game/course';
import { placeCamera, fitFov } from '../game/camera';

const PAPER = 0xe9e6df;
const INK = 0x2b2a28;
const BEAD_COLOR = 0x7b4a24; // 木の珠（仮）

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  private raft = new THREE.Group();
  private daruma = new THREE.Group();
  private water: THREE.Mesh;
  private banks: THREE.Mesh[];
  private meshes = new Map<object, THREE.Object3D>();
  private seen = new Set<object>();
  private streaks: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; seed: number }[] = [];
  private flying: { mesh: THREE.Mesh; t: number }[] = [];
  private geo = {
    rock: new THREE.DodecahedronGeometry(1, 0),
    log: new THREE.CylinderGeometry(1, 1, 1, 10),
    bead: new THREE.SphereGeometry(BEAD_RADIUS, 12, 8),
    whirl: new THREE.PlaneGeometry(1, 1),
    wave: new THREE.CylinderGeometry(0.5, 0.5, (BANK_X + 0.6) * 2, 16),
    streak: new THREE.PlaneGeometry(0.9, 0.06),
  };
  private mat = {
    rock: new THREE.MeshLambertMaterial({ color: INK, flatShading: true }),
    log: new THREE.MeshLambertMaterial({ color: 0x4a4038 }),
    bead: new THREE.MeshLambertMaterial({ color: BEAD_COLOR, emissive: 0x2a1408 }),
    whirl: new THREE.MeshBasicMaterial({ map: makeWhirlTexture(), transparent: true, depthWrite: false }),
    wave: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x888888 }),
  };
  private leafZ = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(PAPER);
    this.scene.fog = new THREE.Fog(PAPER, 45, 135);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x888880, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 10, 4);
    this.scene.add(sun);

    this.water = new THREE.Mesh(new THREE.PlaneGeometry(600, 320), new THREE.MeshLambertMaterial({ color: 0xc9c8c2 }));
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);
    const bankMat = new THREE.MeshLambertMaterial({ color: 0x55534f });
    this.banks = [-1, 1].map((side) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 320), bankMat);
      m.position.x = side * BANK_X;
      this.scene.add(m);
      return m;
    });

    // 葉と達磨（簡単な形。ステップ3で差し替え）
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), new THREE.MeshLambertMaterial({ color: 0x5f6b45 }));
    leaf.scale.set(0.35, 0.06, 1.3);
    this.raft.add(leaf);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
    body.scale.set(1, 1.1, 1);
    body.position.y = 0.45;
    this.daruma.add(body);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshLambertMaterial({ color: 0xf2e6d0 }));
    face.position.set(0, 0.55, -0.4);
    face.rotation.y = Math.PI;
    this.daruma.add(face);
    this.raft.add(this.daruma);
    this.scene.add(this.raft);

    // 横向きの流れを見せる水面の筋
    const rng = mulberry(5);
    for (let i = 0; i < 120; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x6d6b66, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(this.geo.streak, mat);
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      this.streaks.push({ mesh, mat, seed: rng() });
    }
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.fov = fitFov(w / h);
    this.aspect = w / h;
  }
  private fov = 45;
  private aspect = 1;

  /** 画面上の点を、葉のいる位置での川の左右位置に変える（指の真下に葉が寄っていく） */
  screenToRiverX(clientX: number, clientY: number, w: number, h: number): number {
    const ndc = new THREE.Vector2((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    // 葉の深さの縦の面との交点（どの高さを触っても左右の位置だけを見る）
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.leafZ);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return 0;
    return hit.x;
  }

  /** タイトル画面：霧の水面で達磨が静かに揺れている */
  renderTitle(t: number) {
    const z = -t * 1.5;
    this.leafZ = z;
    this.raft.visible = true;
    this.raft.position.set(0, 0.05, z);
    this.raft.rotation.set(0, Math.sin(t * 0.4) * 0.1, Math.sin(t * 1.1) * 0.08);
    this.daruma.position.set(0, Math.sin(t * 1.7) * 0.04, 0);
    this.daruma.rotation.set(0, 0, Math.sin(t * 1.3) * 0.06);
    this.clearObstacles();
    this.follow(z);
    this.streaks.forEach((s) => (s.mat.opacity = 0));
    this.renderer.render(this.scene, this.camera);
  }

  /** プレイ中の画面 */
  render(sim: Sim, t: number, dt: number, sinceRecover: number) {
    const z = -sim.distance;
    this.leafZ = z;
    const p = sim.player;
    this.raft.position.set(p.x, 0.05, z);
    let roll = clamp(-p.vx * 0.06, -0.35, 0.35);
    if (sim.waveT > 0) roll += Math.sin(t * 14) * 0.3 * (sim.waveT / WAVE_TIME); // 大波で大きく揺れる
    this.raft.rotation.set(0, clamp(-p.vx * 0.03, -0.2, 0.2), roll);
    this.animateDaruma(sim, t, sinceRecover);
    // 戻った直後の無敵の間は点滅
    this.raft.visible = !(sim.invulnerable && Math.floor(t * 10) % 2 === 0);

    this.syncObstacles(sim, t);
    this.syncStreaks(sim);
    this.updateFlying(dt);
    this.follow(z);
    this.renderer.render(this.scene, this.camera);
  }

  /** 拾った珠が小さく光って上へ吸い込まれる */
  collect(bead: Bead) {
    const mesh = this.meshes.get(bead) as THREE.Mesh | undefined;
    if (!mesh) return;
    this.meshes.delete(bead);
    mesh.material = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true });
    this.flying.push({ mesh, t: 0 });
  }

  private follow(z: number) {
    this.water.position.z = z - 100;
    this.banks.forEach((b) => (b.position.z = z - 100));
    placeCamera(this.camera, this.aspect, z, this.fov);
  }

  private animateDaruma(sim: Sim, t: number, sinceRecover: number) {
    const d = this.daruma;
    if (sim.phase === 'capsized' || sim.phase === 'over') {
      // 水に落ちて…ぷかっと浮かんで葉に戻る（起き上がり小法師）
      const k = sim.phase === 'over' ? 0.6 : 1 - sim.capsizeT / CAPSIZE_TIME;
      if (k < 0.3) {
        const a = k / 0.3;
        d.position.set(a * 0.6, -0.9 * a * a, 0);
        d.rotation.set(0, 0, -a * 1.7);
      } else if (k < 0.65) {
        d.position.set(0.6, -0.9 + Math.sin(t * 8) * 0.04, 0);
        d.rotation.set(0, 0, -1.7);
      } else {
        const a = (k - 0.65) / 0.35;
        const pop = Math.sin(a * Math.PI) * 0.5; // ぷかっと飛び出す
        d.position.set(0.6 * (1 - a), -0.9 * (1 - a) + pop, 0);
        d.rotation.set(0, 0, -1.7 * (1 - a) * (1 - a));
      }
      return;
    }
    // 戻ったあとは起き上がり小法師のようにゆらゆら
    const wobble = sinceRecover < 1.5 ? Math.sin(sinceRecover * 12) * 0.35 * (1 - sinceRecover / 1.5) : 0;
    d.position.set(0, Math.sin(t * 3) * 0.03, 0);
    d.rotation.set(0, 0, wobble);
  }

  private clearObstacles() {
    for (const m of this.meshes.values()) this.scene.remove(m);
    this.meshes.clear();
    for (const f of this.flying) this.scene.remove(f.mesh);
    this.flying = [];
  }

  reset() { this.clearObstacles(); }

  private getMesh(key: object, make: () => THREE.Object3D): THREE.Object3D {
    this.seen.add(key);
    let m = this.meshes.get(key);
    if (!m) {
      m = make();
      this.scene.add(m);
      this.meshes.set(key, m);
    }
    return m;
  }

  private syncObstacles(sim: Sim, t: number) {
    this.seen.clear();
    const time = sim.time;
    for (const row of sim.course.rows) {
      for (const o of row.obstacles) {
        if (o.kind === 'rock') {
          const r = o as Rock;
          this.getMesh(r, () => {
            const m = new THREE.Mesh(this.geo.rock, this.mat.rock);
            m.scale.set(r.r, r.r * 1.4, r.r);
            m.position.set(r.x, r.r * 0.4, -r.z);
            m.rotation.set(r.x * 3.1, r.z * 1.7, 0);
            return m;
          });
        } else if (o.kind === 'log') {
          const l = o as Log;
          const m = this.getMesh(l, () => {
            const mesh = new THREE.Mesh(this.geo.log, this.mat.log);
            mesh.scale.set(l.r, l.half * 2, l.r);
            mesh.rotation.z = Math.PI / 2;
            return mesh;
          });
          const x = logX(l, time);
          m.position.set(x, 0.12, -l.z);
          m.rotation.x = time * l.vx * 0.8; // 転がるように回る
          m.visible = Math.abs(x) - l.half < BANK_X; // 岸の外では見せない
        } else if (o.kind === 'whirl') {
          const w = o as Whirl;
          const m = this.getMesh(w, () => {
            const mesh = new THREE.Mesh(this.geo.whirl, this.mat.whirl);
            mesh.rotation.x = -Math.PI / 2;
            mesh.scale.setScalar(w.pull * 2);
            mesh.position.set(w.x, 0.02, -w.z);
            return mesh;
          });
          m.rotation.z = t * 2.2 * w.spin;
        } else if (o.kind === 'wave') {
          const wv = o as Wave;
          const m = this.getMesh(wv, () => {
            const mesh = new THREE.Mesh(this.geo.wave, this.mat.wave);
            mesh.rotation.z = Math.PI / 2;
            mesh.scale.set(1, 1, 1.3);
            return mesh;
          });
          m.position.set(0, -0.05 + Math.sin(t * 5) * 0.05, -waveZ(wv, time));
          m.visible = !wv.hit;
        }
      }
    }
    for (const b of sim.course.beads) {
      if (b.taken) continue;
      const m = this.getMesh(b, () => new THREE.Mesh(this.geo.bead, this.mat.bead));
      m.position.set(b.x, 0.15 + Math.sin(t * 3 + b.id) * 0.06, -b.z); // ぷかぷか
    }
    for (const [key, m] of this.meshes) {
      if (!this.seen.has(key)) {
        this.scene.remove(m);
        this.meshes.delete(key);
      }
    }
  }

  /** 横向きの流れがある場所に、流れる向きへ動く筋を出す */
  private syncStreaks(sim: Sim) {
    const SPACING = 3;
    const perRow = 3;
    const base = Math.floor(sim.distance / SPACING) - 3;
    const width = RIVER_HALF_WIDTH * 2;
    this.streaks.forEach((s, i) => {
      const row = base + Math.floor(i / perRow);
      const z = row * SPACING + s.seed * 2;
      const strength = sim.course.currentAt(z);
      const offset = (s.seed * 37 + (i % perRow) / perRow) * width + sim.time * strength * 1.5;
      const x = (((offset % width) + width) % width) - RIVER_HALF_WIDTH;
      s.mesh.position.set(x, 0.01, -z);
      s.mat.opacity = Math.min(1, Math.abs(strength) / 2.6) * 0.55;
    });
  }

  private updateFlying(dt: number) {
    this.flying = this.flying.filter((f) => {
      f.t += dt;
      const k = f.t / 0.45;
      f.mesh.position.y += dt * 9;
      f.mesh.scale.setScalar(1 + k * 1.5);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      if (k >= 1) { this.scene.remove(f.mesh); return false; }
      return true;
    });
  }
}

/** 渦巻きの模様（墨の渦）を描いた画像 */
function makeWhirlTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  for (let arm = 0; arm < 3; arm++) {
    g.beginPath();
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 4 + (arm * Math.PI * 2) / 3;
      const r = 10 + (i / 200) * 115;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(40,38,36,0.55)';
    g.lineWidth = 6;
    g.stroke();
  }
  g.beginPath();
  g.arc(0, 0, 24, 0, Math.PI * 2);
  g.fillStyle = 'rgba(20,20,20,0.85)';
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
