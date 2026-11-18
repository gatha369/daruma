// 3Dの表示。ゲームの状態（Sim）を受け取って、水墨画風に描く
import * as THREE from 'three';
import { BANK_X, RIVER_HALF_WIDTH, clamp } from '../game/logic';
import { Sim, CAPSIZE_TIME, WAVE_TIME, GLOW_WARN } from '../game/sim';
import { Washi, Nenju, Log, Rock, Wave, Whirl, logX, waveZ } from '../game/course';
import { NENJU_BEADS, NENJU_BEAD_R, OYADAMA_R, nenjuBead, oyadamaPos, glowLevel } from '../game/rosary';
import { placeCamera, fitFov } from '../game/camera';
import { Palette, RGB, paletteAt } from '../game/scenery';
import { QualitySettings } from '../game/quality';
import { toon, outlineMaterial, setRGB, whirlTexture, strokeTexture, mulberry, discTexture } from './textures';
import { Water } from './water';
import { Backdrop } from './backdrop';
import { Wake } from './wake';
import { Raft } from './raft';

interface Ripple { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; life: number; size: number; active: boolean }

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  palette: Palette = paletteAt(0);
  private fog = new THREE.Fog(0xffffff, 30, 120);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x888880, 2.2);
  private sun = new THREE.DirectionalLight(0xffffff, 1.2);
  private water = new Water();
  private backdrop = new Backdrop();
  private wake = new Wake();
  private raft = new Raft();
  private banks: THREE.Mesh[];
  private bankMat = toon(0x4a4845);
  private meshes = new Map<object, THREE.Object3D>();
  private seen = new Set<object>();
  private streaks: { mesh: THREE.Mesh; seed: number }[] = [];
  private ripples: Ripple[] = [];
  private outlinesOn = true;
  private geo = {
    rock: new THREE.DodecahedronGeometry(1, 0),
    log: new THREE.CylinderGeometry(1, 0.85, 1, 10),
    washi: washiGeometry(),
    washiEdge: new THREE.PlaneGeometry(0.78, 0.78),
    nenjuBead: new THREE.SphereGeometry(NENJU_BEAD_R, 12, 8),
    oyadama: new THREE.SphereGeometry(OYADAMA_R, 14, 10),
    tassel: new THREE.ConeGeometry(0.08, 0.34, 10),
    glow: new THREE.PlaneGeometry(1, 1),
    whirl: new THREE.PlaneGeometry(1, 1),
    wave: new THREE.CylinderGeometry(0.5, 0.5, (BANK_X + 0.6) * 2, 16),
    streak: new THREE.PlaneGeometry(1.4, 0.18),
    ring: new THREE.RingGeometry(0.85, 1, 48),
  };
  private mat = {
    rock: toon(0x34322f),
    log: toon(0x4a4038),
    washi: toon(0xfbf8f0, { side: THREE.DoubleSide }),
    washiEdge: new THREE.MeshBasicMaterial({ color: 0x3a3835, transparent: true, opacity: 0.55, depthWrite: false }),
    nenju: toon(0x6b3d1e, { emissive: 0x3a1c08 }),
    tassel: toon(0x8e2a22, { emissive: 0x2a0806 }),
    nenjuGlow: new THREE.MeshBasicMaterial({ map: discTexture(0.8), color: 0xffd27a, transparent: true, opacity: 0.6, depthWrite: false }),
    whirl: new THREE.MeshBasicMaterial({ map: whirlTexture(), transparent: true, depthWrite: false }),
    wave: toon(0xf4f2ec),
    streak: new THREE.MeshBasicMaterial({ map: strokeTexture(), transparent: true, depthWrite: false }),
  };
  private leafZ = 0;
  private fov = 45;
  private aspect = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color();
    this.scene.fog = this.fog;
    this.scene.add(this.hemi);
    this.sun.position.set(3, 10, 4);
    this.scene.add(this.sun);
    this.scene.add(this.water.mesh);
    this.scene.add(this.backdrop.group);
    this.scene.add(this.wake.mesh);
    this.scene.add(this.raft.group);

    this.banks = [-1, 1].map((side) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 320), this.bankMat);
      m.position.x = side * BANK_X;
      this.scene.add(m);
      return m;
    });

    // 横向きの流れを見せる、筆で払ったような筋
    const rng = mulberry(5);
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(this.geo.streak, this.mat.streak.clone());
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      this.streaks.push({ mesh, seed: rng() });
    }

    // 波紋（珠を拾う・水に落ちる・念珠の完成）
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
      const mesh = new THREE.Mesh(this.geo.ring, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.scene.add(mesh);
      this.ripples.push({ mesh, mat, t: 0, life: 1, size: 1, active: false });
    }
    this.applyPalette(this.palette, 0);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.fov = fitFov(w / h);
    this.aspect = w / h;
  }

  /** 画質の段階を切り替える（第8章） */
  setQuality(q: QualitySettings) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.water.setDetail(q.waterDetail);
    this.backdrop.mistGroup.visible = q.mist;
    this.outlinesOn = q.outlines;
    this.raft.setOutlines(q.outlines);
    for (const m of this.meshes.values()) {
      m.traverse((o) => { if (o.userData.outline) o.visible = q.outlines; });
    }
    this.wake.mesh.visible = q.wake;
  }

  /** 画面上の点を、葉のいる位置での川の左右位置に変える（指の真下に葉が寄っていく） */
  screenToRiverX(clientX: number, clientY: number, w: number, h: number): number {
    const ndc = new THREE.Vector2((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.leafZ);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return 0;
    return hit.x;
  }

  /** 3Dの位置が画面上のどこか（ピクセル） */
  toScreen(x: number, y: number, z: number, w: number, h: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  /** タイトル画面：霧の水面で達磨が静かに揺れている */
  renderTitle(t: number, dt: number) {
    const z = -t * 1.5;
    this.leafZ = z;
    this.palette = paletteAt(0);
    this.applyPalette(this.palette, t);
    const raft = this.raft.group;
    raft.visible = true;
    raft.position.set(0, 0.05, z);
    raft.rotation.set(0, Math.sin(t * 0.4) * 0.1, Math.sin(t * 1.1) * 0.08);
    this.raft.daruma.position.set(0, Math.sin(t * 1.7) * 0.04, 0);
    this.raft.daruma.rotation.set(0, 0, Math.sin(t * 1.3) * 0.06);
    this.raft.setGlow(0, t);
    this.raft.animate(t, dt, 0, 1.5, 0);
    this.clearObstacles();
    this.wake.update(0, z + 1.25, t, this.palette.ink);
    this.follow(z);
    this.streaks.forEach((s) => (s.mesh.visible = false));
    this.updateRipples(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** プレイ中の画面 */
  render(sim: Sim, t: number, dt: number, sinceRecover: number) {
    const z = -sim.distance;
    this.leafZ = z;
    this.palette = paletteAt(sim.progress);
    this.applyPalette(this.palette, t);
    const p = sim.player;
    const raft = this.raft.group;
    raft.position.set(p.x, 0.05, z);
    const waveK = sim.waveT / WAVE_TIME;
    let roll = clamp(-p.vx * 0.06, -0.35, 0.35);
    if (waveK > 0) roll += Math.sin(t * 14) * 0.3 * waveK; // 大波で大きく揺れる
    raft.rotation.set(Math.sin(t * 2.1) * 0.02, clamp(-p.vx * 0.03, -0.2, 0.2), roll);
    this.raft.setGlow(glowLevel(sim.glowT, GLOW_WARN, t), t);
    this.raft.animate(t, dt, p.vx, sim.speed, waveK);
    this.animateDaruma(sim, t, sinceRecover);
    raft.visible = !(sim.invulnerable && Math.floor(t * 10) % 2 === 0); // 無敵の間は点滅

    this.syncObstacles(sim, t);
    this.syncStreaks(sim);
    this.wake.update(p.x, z + 1.25, sim.time, this.palette.ink);
    this.updateRipples(dt);
    this.follow(z);
    this.renderer.render(this.scene, this.camera);
  }

  /** 和紙を拾った：その場に小さな墨の輪 */
  collect(w: Washi) {
    this.removeMesh(w);
    this.ripple(w.x, -w.z, 0.6, 0.45, this.palette.ink);
  }

  /** 念珠を拾った：水面に光の輪が広がる */
  nenju(n: Nenju) {
    this.removeMesh(n);
    for (let i = 0; i < 3; i++) this.ripple(n.x, -n.z, 2 + i, 1, [1, 0.8, 0.4], i * 0.12);
  }

  private removeMesh(key: object) {
    const m = this.meshes.get(key);
    if (m) { this.scene.remove(m); this.meshes.delete(key); }
  }

  /** 水に落ちた（big）・葉に戻った */
  splash(x: number, z: number, big: boolean) {
    this.ripple(x, z, big ? 2.2 : 1.2, big ? 1 : 0.7, this.palette.ink);
    if (big) this.ripple(x, z, 1.4, 0.8, this.palette.ink, 0.15);
  }

  get glowing() { return this.raft.glowing; }

  reset() {
    this.clearObstacles();
    this.raft.reset();
    this.wake.reset();
  }

  private applyPalette(p: Palette, t: number) {
    setRGB(this.scene.background as THREE.Color, p.sky);
    setRGB(this.fog.color, p.fog);
    this.fog.near = p.fogNear;
    this.fog.far = p.fogFar;
    this.hemi.intensity = 2.2 * p.light;
    this.sun.intensity = 1.2 * p.light;
    setRGB(this.mat.whirl.color, p.ink);
    setRGB(this.bankMat.color, p.dark > 0.5 ? p.mountain : p.ink);
    this.water.update(p, t, this.leafZ);
    this.backdrop.update(p, t, this.leafZ);
  }

  private follow(z: number) {
    this.banks.forEach((b) => (b.position.z = z - 100));
    placeCamera(this.camera, this.aspect, z, this.fov);
  }

  private animateDaruma(sim: Sim, t: number, sinceRecover: number) {
    const d = this.raft.daruma;
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
    // 戻ったあとは起き上がり小法師のようにゆらゆら。ふだんは動きと逆に傾き、少し前のめり
    const wobble = sinceRecover < 1.5 ? Math.sin(sinceRecover * 12) * 0.35 * (1 - sinceRecover / 1.5) : 0;
    d.position.set(0, Math.sin(t * 3) * 0.03, 0);
    d.rotation.set(-0.06 - sim.speed * 0.004, 0, wobble + this.raft.darumaLean);
  }

  private ripple(x: number, z: number, size: number, life: number, color: RGB, delay = 0) {
    const r = this.ripples.find((q) => !q.active) ?? this.ripples[0];
    r.active = true;
    r.t = -delay;
    r.life = life;
    r.size = size;
    setRGB(r.mat.color, color);
    r.mesh.position.set(x, 0.04, z);
    r.mesh.visible = false;
  }

  private updateRipples(dt: number) {
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / r.life;
      if (k >= 1) { r.active = false; r.mesh.visible = false; continue; }
      r.mesh.visible = true;
      r.mesh.scale.setScalar(0.2 + r.size * Math.sqrt(k));
      r.mat.opacity = (1 - k) * 0.7;
    }
  }

  private clearObstacles() {
    for (const m of this.meshes.values()) this.scene.remove(m);
    this.meshes.clear();
  }

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

  /** 墨の輪郭線つきの形 */
  private inked(geo: THREE.BufferGeometry, mat: THREE.Material, thickness: number, longAxis = false): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    const line = new THREE.Mesh(geo, outlineMaterial);
    // 細長い形（流木・大波）は長さ方向には広げない（端がはみ出さないように）
    line.scale.set(1 + thickness, longAxis ? 1.01 : 1 + thickness, 1 + thickness);
    line.userData.outline = true;
    line.visible = this.outlinesOn;
    g.add(line);
    return g;
  }

  private syncObstacles(sim: Sim, t: number) {
    this.seen.clear();
    const time = sim.time;
    for (const row of sim.course.rows) {
      for (const o of row.obstacles) {
        if (o.kind === 'rock') {
          const r = o as Rock;
          this.getMesh(r, () => {
            const m = this.inked(this.geo.rock, this.mat.rock, 0.09);
            m.scale.set(r.r, r.r * 1.4, r.r);
            m.position.set(r.x, r.r * 0.4, -r.z);
            m.rotation.set(r.x * 3.1, r.z * 1.7, 0);
            return m;
          });
        } else if (o.kind === 'log') {
          const l = o as Log;
          const m = this.getMesh(l, () => {
            const g = this.inked(this.geo.log, this.mat.log, 0.12, true);
            g.scale.set(l.r, l.half * 2, l.r);
            g.rotation.z = Math.PI / 2;
            return g;
          });
          const x = logX(l, time);
          m.position.set(x, 0.12, -l.z);
          m.rotation.x = time * l.vx * 0.8;
          m.visible = Math.abs(x) - l.half < BANK_X;
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
            const g = this.inked(this.geo.wave, this.mat.wave, 0.08, true);
            g.rotation.z = Math.PI / 2;
            g.scale.set(1, 1, 1.3);
            return g;
          });
          m.position.set(0, -0.05 + Math.sin(t * 5) * 0.05, -waveZ(wv, time));
          m.visible = !wv.hit;
        }
      }
    }
    for (const w of sim.course.washi) {
      if (w.taken) continue;
      const m = this.getMesh(w, () => this.makeWashi(w.id));
      // 水面に浮いて、少し揺れる
      m.position.set(w.x, 0.06 + Math.sin(t * 2.5 + w.id) * 0.03, -w.z);
      m.rotation.set(Math.sin(t * 1.8 + w.id) * 0.08, (w.id * 0.7) % Math.PI, Math.sin(t * 2.1 + w.id * 2) * 0.08);
    }
    for (const n of sim.course.nenjus) {
      if (n.taken) continue;
      const m = this.getMesh(n, () => this.makeNenju());
      m.position.set(n.x, 0.12 + Math.sin(t * 2.4 + n.id) * 0.05, -n.z);
      m.rotation.y = t * 0.8;
      const glow = m.userData.glow as THREE.Mesh;
      glow.rotation.z = -t * 0.8; // 光は回さない（輪と一緒に回る分を打ち消す）
      glow.scale.setScalar(2.2 + Math.sin(t * 4) * 0.2);
    }
    for (const [key, m] of this.meshes) {
      if (!this.seen.has(key)) {
        this.scene.remove(m);
        this.meshes.delete(key);
      }
    }
  }

  /** 和紙：白い四角の紙。少し波打っていて、縁に墨の影 */
  private makeWashi(id: number): THREE.Object3D {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(this.geo.washi, this.mat.washi);
    g.add(paper);
    const edge = new THREE.Mesh(this.geo.washiEdge, this.mat.washiEdge);
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = -0.03;
    g.add(edge);
    g.userData.id = id;
    return g;
  }

  /** 念珠：玉9個と親玉1つの輪に、親玉から簡単な房（簡略化した形）。まわりに光をまとう */
  private makeNenju(): THREE.Object3D {
    const g = new THREE.Group();
    const glow = new THREE.Mesh(this.geo.glow, this.mat.nenjuGlow);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.05;
    g.add(glow);
    g.userData.glow = glow;
    const ring = new THREE.InstancedMesh(this.geo.nenjuBead, this.mat.nenju, NENJU_BEADS);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < NENJU_BEADS; i++) {
      const p = nenjuBead(i);
      ring.setMatrixAt(i, mtx.makeTranslation(p.x, p.y, p.z));
    }
    g.add(ring);
    const o = oyadamaPos();
    const oya = new THREE.Mesh(this.geo.oyadama, this.mat.nenju);
    oya.position.set(o.x, o.y, o.z);
    g.add(oya);
    const tassel = new THREE.Mesh(this.geo.tassel, this.mat.tassel);
    tassel.position.set(o.x, o.y, o.z + OYADAMA_R + 0.15);
    tassel.rotation.x = -Math.PI / 2; // 房は水面に寝かせ、親玉の側を細く、輪の外へ広がるように
    g.add(tassel);
    g.scale.setScalar(1.15);
    return g;
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
      s.mesh.position.set(x, 0.015, -z);
      s.mesh.rotation.z = strength < 0 ? Math.PI : 0; // 筆の入りが流れの上手側
      s.mesh.visible = strength !== 0;
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      setRGB(mat.color, this.palette.ink);
      mat.opacity = Math.min(1, Math.abs(strength) / 2.6) * 0.6;
    });
  }
}

/** 和紙の形：少し波打った四角い紙 */
function washiGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.7, 0.7, 6, 6);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, 0.03 * Math.sin(x * 9 + 1) + 0.025 * Math.sin(z * 7));
  }
  geo.computeVertexNormals();
  return geo;
}
