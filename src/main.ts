// ステップ1：最小限で遊べる版（平らな水面・葉・達磨・岩・距離表示）
import * as THREE from 'three';
import {
  RIVER_HALF_WIDTH, ROW_SPACING, Player, Row, Rock,
  speedAt, stepPlayer, hitsAny, formatRi, makeRow, makeRng, clamp,
} from './game/logic';
import { Input } from './game/input';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const distanceEl = document.getElementById('distance')!;
const overlay = document.getElementById('overlay')!;
const overlayTitle = document.getElementById('overlay-title')!;
const overlaySub = document.getElementById('overlay-sub')!;

// ---- 描画の準備 ----
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const PAPER = 0xe9e6df;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, 25, 90);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x888880, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(3, 10, 4);
scene.add(sun);

// 水面（平ら）と川岸の目印。プレイヤーに合わせて一緒に動かす
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 240),
  new THREE.MeshLambertMaterial({ color: 0xc9c8c2 }),
);
water.rotation.x = -Math.PI / 2;
scene.add(water);
const bankMat = new THREE.MeshLambertMaterial({ color: 0x55534f });
const banks = [-1, 1].map((side) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 240), bankMat);
  m.position.x = side * (RIVER_HALF_WIDTH + 1.2);
  scene.add(m);
  return m;
});

// 葉と達磨（簡単な形）
const raft = new THREE.Group();
const leaf = new THREE.Mesh(
  new THREE.SphereGeometry(1, 20, 10),
  new THREE.MeshLambertMaterial({ color: 0x5f6b45 }),
);
leaf.scale.set(0.35, 0.06, 1.3);
raft.add(leaf);
const daruma = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.SphereGeometry(0.42, 24, 16),
  new THREE.MeshLambertMaterial({ color: 0xc0392b }),
);
body.scale.set(1, 1.1, 1);
body.position.y = 0.45;
daruma.add(body);
const face = new THREE.Mesh(
  new THREE.CircleGeometry(0.2, 20),
  new THREE.MeshLambertMaterial({ color: 0xf2e6d0 }),
);
// 葉は奥（-z）へ進むので、顔は進行方向を向く＝カメラからは背中が見える
face.position.set(0, 0.55, -0.4);
face.rotation.y = Math.PI;
daruma.add(face);
raft.add(daruma);
scene.add(raft);

// 岩
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = new THREE.MeshLambertMaterial({ color: 0x2b2a28, flatShading: true });
const rockMeshes = new Map<Rock, THREE.Mesh>();

function addRockMesh(r: Rock) {
  const m = new THREE.Mesh(rockGeo, rockMat);
  m.scale.set(r.r, r.r * 1.4, r.r);
  m.position.set(r.x, r.r * 0.4, -r.z);
  m.rotation.set(r.x * 3.1, r.z * 1.7, 0);
  scene.add(m);
  rockMeshes.set(r, m);
}

// ---- ゲームの状態 ----
type Phase = 'ready' | 'playing' | 'over';
let phase: Phase = 'ready';
let player: Player = { x: 0, vx: 0, targetX: 0 };
let distance = 0;
let elapsed = 0;
let rows: Row[] = [];
let nextRowZ = 0;
let lastGapX = 0;
let overAt = 0;
let rng = makeRng(Date.now());

const input = new Input(canvas);

function resetGame() {
  for (const m of rockMeshes.values()) scene.remove(m);
  rockMeshes.clear();
  rows = [];
  player = { x: 0, vx: 0, targetX: 0 };
  input.reset();
  distance = 0;
  elapsed = 0;
  nextRowZ = 30; // 最初の岩までは少し余裕を持たせる
  lastGapX = 0;
  rng = makeRng(Date.now());
}

function spawnRows() {
  while (nextRowZ < distance + 110) {
    const row = makeRow(nextRowZ, lastGapX, nextRowZ, rng);
    lastGapX = row.gapX;
    rows.push(row);
    row.rocks.forEach(addRockMesh);
    nextRowZ += ROW_SPACING;
  }
  // 後ろに流れた列を片付ける
  while (rows.length && rows[0].z < distance - 15) {
    rows.shift()!.rocks.forEach((r) => {
      const m = rockMeshes.get(r);
      if (m) scene.remove(m);
      rockMeshes.delete(r);
    });
  }
}

input.onAction = () => {
  if (phase === 'ready' || (phase === 'over' && performance.now() - overAt > 800)) {
    resetGame();
    phase = 'playing';
    overlay.classList.remove('show');
  }
};

function gameOver() {
  phase = 'over';
  overAt = performance.now();
  overlayTitle.textContent = `${formatRi(distance)} 里`;
  overlaySub.textContent = '岩にぶつかりました ― タップ・キーでもう一度';
  overlay.classList.add('show');
}

// ---- 毎コマの処理 ----
function update(dt: number) {
  if (phase !== 'playing') return;
  elapsed += dt;
  input.update(dt);
  player = stepPlayer({ ...player, targetX: input.targetX }, dt);
  distance += speedAt(elapsed) * dt;
  spawnRows();
  const nearby = rows.filter((r) => Math.abs(r.z - distance) < 4).flatMap((r) => r.rocks);
  if (hitsAny(player.x, distance, nearby)) gameOver();
}

function render(t: number) {
  raft.position.set(player.x, 0.05, -distance);
  // 左右に動くと進行方向へ少し傾く
  raft.rotation.z = clamp(-player.vx * 0.06, -0.35, 0.35);
  raft.rotation.y = clamp(-player.vx * 0.03, -0.2, 0.2);
  daruma.position.y = Math.sin(t * 0.003) * 0.03; // 水に乗ってわずかに揺れる
  water.position.z = -distance - 80;
  banks.forEach((b) => (b.position.z = -distance - 80));
  // 縦持ち（細長い画面）では川幅全体が入らないので、カメラが葉をよく追いかける
  const follow = portrait ? 0.85 : 0.5;
  camera.position.set(player.x * follow, portrait ? 4.6 : 3.6, -distance + (portrait ? 7.5 : 6.5));
  camera.lookAt(player.x * follow * 0.8, 0, -distance - (portrait ? 7 : 10));
  distanceEl.textContent = formatRi(distance);
  renderer.render(scene, camera);
}

let portrait = false;
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 縦持ちでも川幅が収まるように、細長い画面では視野を広げる
  portrait = w / h < 1;
  camera.fov = portrait ? 75 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  render(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 動作確認用（自動テストから状態を読む）
(window as unknown as { __game: unknown }).__game = {
  get phase() { return phase; },
  get distance() { return distance; },
  get x() { return player.x; },
};
