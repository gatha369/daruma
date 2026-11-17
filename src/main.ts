// 画面の切り替え（タイトル → プレイ → 結果）と毎コマの処理
import { formatRi } from './game/logic';
import { Sim, MAX_LIVES, ROSARY_SIZE } from './game/sim';
import { Input } from './game/input';
import { recordRun, loadBest, loadSound, saveSound } from './game/storage';
import { World } from './render/world';
import { QualityController, SETTINGS, initialLevel, Level } from './game/quality';
import { stageAt, STAGES } from './game/scenery';
import { paperDataURL } from './render/textures';
import { SHOP_URL, STORY_TEXT, shareUrl } from './config';

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
// 和紙のざらつきを画面全体にうっすら重ねる
$('paper').style.backgroundImage = `url(${paperDataURL()})`;
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
  $<HTMLAnchorElement>('share-btn').href = shareUrl(formatRi(sim.distance), sim.rosaries);
  resultShownAt = performance.now();
  show('result');
}

// ---- ボタンと操作 ----
$('story').textContent = STORY_TEXT;
$<HTMLAnchorElement>('shop-link').href = SHOP_URL;
$<HTMLAnchorElement>('shop-btn').href = SHOP_URL;
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
  soundOn = !soundOn; // 音そのものはステップ5（第7章の決定後）で入れる。いまは設定の切り替えと保存だけ
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

// ---- 重い端末向けの自動調整（第8章） ----
const isTouch = window.matchMedia('(pointer: coarse)').matches;
// 確認用：アドレスの末尾に ?q=0〜2 を付けると、その画質に固定する（自動調整しない）
const fixedQ = new URLSearchParams(location.search).get('q');
const fixedLevel = fixedQ !== null && ['0', '1', '2'].includes(fixedQ) ? (Number(fixedQ) as Level) : null;
const quality = new QualityController(fixedLevel ?? initialLevel(isTouch));
world.setQuality(SETTINGS[quality.level]);

/** 拾った珠が、画面上部のカウントへ吸い込まれていく */
function flyBead(x: number, z: number) {
  const from = world.toScreen(x, 0.2, z, window.innerWidth, window.innerHeight);
  const to = ui.beadCount.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'fly-bead';
  el.style.transform = `translate(${from.x}px, ${from.y}px)`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = `translate(${to.left + to.width / 2}px, ${to.top + to.height / 2}px) scale(0.6)`;
    el.style.opacity = '0.2';
  }));
  setTimeout(() => el.remove(), 550);
}

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
      flyBead(e.bead.x, -e.bead.z);
      ui.beadsWrap.classList.remove('pulse');
      void ui.beadsWrap.offsetWidth; // アニメーションをやり直すため
      ui.beadsWrap.classList.add('pulse');
    } else if (e.type === 'rosary') {
      world.rosary(sim);
      toast(`念珠 一連 完成（${ROSARY_SIZE}珠）`);
    } else if (e.type === 'capsize') {
      world.splash(sim.player.x, -sim.distance, true);
    } else if (e.type === 'recover') {
      sinceRecover = 0;
      world.splash(sim.player.x, -sim.distance, false);
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
  if (screen === 'title') world.renderTitle(t, dt);
  else world.render(sim, t, screen === 'playing' && !rotateBlock ? dt : 0, sinceRecover);
  updateHud();
  // 夜の景色では文字を白くする
  document.body.classList.toggle('night', world.palette.dark > 0.5);
  // 滑らかに動いていなければ、見た目を軽くする
  if (fixedLevel === null && (screen === 'playing' || screen === 'title')) {
    const lv = quality.frame(dt);
    if (lv !== null) world.setQuality(SETTINGS[lv]);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 動作確認用（自動テストから状態を読む）
(window as unknown as { __game: unknown }).__game = {
  get screen() { return screen; },
  get sim() { return sim; },
  get rotateBlock() { return rotateBlock; },
  best: () => loadBest(),
  get quality() { return quality.level; },
  get stage() { const s = stageAt(sim.distance); return STAGES[s.t < 0.5 ? s.from : s.to].name; },
  get wearingRosary() { return world.wearingRosary; },
};
