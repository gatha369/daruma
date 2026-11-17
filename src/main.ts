// 画面の切り替え（タイトル → プレイ → 結果）と毎コマの処理
import { formatRi } from './game/logic';
import { Sim, MAX_LIVES, ROSARY_SIZE } from './game/sim';
import { Input } from './game/input';
import { recordRun, loadBest, loadSound, saveSound } from './game/storage';
import { World } from './render/world';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ui = {
  hud: $('hud'), lives: $('lives'), distance: $('distance'), beadCount: $('bead-count'),
  beadsWrap: document.querySelector('#score .beads') as HTMLElement,
  rosaryWrap: $('rosary-wrap'), rosaryCount: $('rosary-count'), toast: $('toast'),
  title: $('title'), pause: $('pause'), result: $('result'), rotate: $('rotate'),
  sound: $('sound-btn'),
};

const world = new World(canvas);
const input = new Input((cx, cy) => world.screenToRiverX(cx, cy, window.innerWidth, window.innerHeight));

type Screen = 'title' | 'playing' | 'paused' | 'result';
let screen: Screen = 'title';
let sim = new Sim();
let sinceRecover = 99;
let overTimer = -1; // 転覆しきってから結果画面を出すまでの間
let resultShownAt = 0;
let rotateBlock = false; // スマホを縦に持っていて止めている

// ---- 残り回数（小さな達磨のアイコン） ----
const DARUMA_ICON = '<svg viewBox="0 0 22 24"><ellipse cx="11" cy="14" rx="9" ry="9.5" fill="#c0392b"/><circle cx="11" cy="11" r="4.6" fill="#f2e6d0"/><circle cx="9.3" cy="10.6" r="0.9" fill="#222"/><circle cx="12.7" cy="10.6" r="0.9" fill="#222"/></svg>';
ui.lives.innerHTML = DARUMA_ICON.repeat(MAX_LIVES);
const lifeIcons = Array.from(ui.lives.querySelectorAll('svg'));

function show(next: Screen) {
  screen = next;
  ui.title.hidden = next !== 'title';
  ui.pause.hidden = next !== 'paused';
  ui.result.hidden = next !== 'result';
  ui.hud.hidden = next === 'title';
}

function startGame() {
  sim = new Sim();
  world.reset();
  input.reset();
  sinceRecover = 99;
  overTimer = -1;
  show('playing');
}

function toTitle() {
  world.reset();
  show('title');
}

function pause() { if (screen === 'playing') show('paused'); }
function resume() { if (screen === 'paused') show('playing'); }

let toastTimer = 0;
function toast(text: string) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), 1600);
}

function showResult() {
  const { best, isNew } = recordRun({ distance: sim.distance, beads: sim.totalBeads, rosaries: sim.rosaries });
  $('r-distance').textContent = formatRi(sim.distance);
  $('r-beads').textContent = String(sim.totalBeads);
  $('r-rosaries').textContent = String(sim.rosaries);
  $('b-distance').textContent = formatRi(best.distance);
  $('b-beads').textContent = String(best.beads);
  $('b-rosaries').textContent = String(best.rosaries);
  $('r-distance-new').hidden = !isNew.distance;
  $('r-beads-new').hidden = !isNew.beads;
  $('r-rosaries-new').hidden = !isNew.rosaries;
  resultShownAt = performance.now();
  show('result');
}

// ---- ボタンと操作 ----
$('start-btn').addEventListener('click', startGame);
$('pause-btn').addEventListener('click', pause);
$('resume-btn').addEventListener('click', resume);
$('quit-btn').addEventListener('click', toTitle);
$('retry-btn').addEventListener('click', startGame);
$('title-btn').addEventListener('click', toTitle);

let soundOn = loadSound();
function updateSoundLabel() {
  ui.sound.textContent = soundOn ? '音：オン' : '音：オフ';
  ui.sound.setAttribute('aria-pressed', String(soundOn));
}
updateSoundLabel();
ui.sound.addEventListener('click', () => {
  soundOn = !soundOn; // 音そのものはステップ4で入れる。いまは設定の切り替えと保存だけ
  saveSound(soundOn);
  updateSoundLabel();
});

input.onTap = () => {
  if (screen === 'title' && !rotateBlock) startGame(); // タイトルはどこを押しても開始
};
input.onKey = (key) => {
  if (rotateBlock) return;
  if (screen === 'title' && key !== 'Escape') startGame();
  else if (screen === 'playing' && (key === 'Escape' || key === 'p' || key === 'P')) pause();
  else if (screen === 'paused' && [' ', 'Enter', 'Escape', 'p', 'P'].includes(key)) resume();
  else if (screen === 'result' && (key === ' ' || key === 'Enter') && performance.now() - resultShownAt > 800) startGame();
};
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---- 画面の向き：スマホは横持ち。縦のときは止めて案内を出し、横にすると自動で再開 ----
const coarse = window.matchMedia('(pointer: coarse)');
function checkOrientation() {
  rotateBlock = coarse.matches && window.innerHeight > window.innerWidth;
  ui.rotate.hidden = !rotateBlock;
}

function resize() {
  world.resize(window.innerWidth, window.innerHeight);
  checkOrientation();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// ---- 毎コマの処理 ----
function updateHud() {
  ui.distance.textContent = formatRi(sim.distance);
  ui.beadCount.textContent = String(sim.beads);
  ui.rosaryWrap.hidden = sim.rosaries === 0;
  ui.rosaryCount.textContent = String(sim.rosaries);
  lifeIcons.forEach((el, i) => el.classList.toggle('lost', i >= sim.lives));
}

function step(dt: number) {
  if (screen !== 'playing' || rotateBlock) return;
  input.update(dt);
  sinceRecover += dt;
  for (const e of sim.update(dt, input.targetX)) {
    if (e.type === 'collect') {
      world.collect(e.bead);
      ui.beadsWrap.classList.remove('pulse');
      void ui.beadsWrap.offsetWidth; // アニメーションをやり直すため
      ui.beadsWrap.classList.add('pulse');
    } else if (e.type === 'rosary') {
      toast(`念珠 一連 完成（${ROSARY_SIZE}珠）`);
    } else if (e.type === 'recover') {
      sinceRecover = 0;
    } else if (e.type === 'wave') {
      toast('大波');
    } else if (e.type === 'gameover') {
      overTimer = 0.6;
    }
  }
  if (overTimer >= 0) {
    overTimer -= dt;
    if (overTimer < 0) showResult();
  }
}

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  const t = now / 1000;
  if (screen === 'title') world.renderTitle(t);
  else world.render(sim, t, screen === 'playing' && !rotateBlock ? dt : 0, sinceRecover);
  updateHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 動作確認用（自動テストから状態を読む）
(window as unknown as { __game: unknown }).__game = {
  get screen() { return screen; },
  get sim() { return sim; },
  get rotateBlock() { return rotateBlock; },
  best: () => loadBest(),
};
