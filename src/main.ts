// 画面の切り替え（タイトル → プレイ → クリア／結果）と毎コマの処理
import { formatTime } from './game/logic';
import { Sim, MAX_LIVES, WASHI_GOAL, GLOW_TIME, GLOW_WARN } from './game/sim';
import { Input } from './game/input';
import { recordRun, loadBest, loadSound, saveSound } from './game/storage';
import { World } from './render/world';
import { QualityController, SETTINGS, initialLevel, Level } from './game/quality';
import { paperDataURL } from './render/textures';
import {
  SHOP_URL, STORY_TEXT, GAME_TITLE, SUBTITLE, HOW_TO, shareUrl, shareTextClear, shareTextPartial,
} from './config';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ui = {
  hud: $('hud'), lives: $('lives'), washiCount: $('washi-count'), score: $('score'),
  glow: $('glow'), glowBar: $('glow-bar'), glowSec: $('glow-sec'), toast: $('toast'),
  title: $('title'), pause: $('pause'), result: $('result'), clear: $('clear'), rotate: $('rotate'),
  clearStage: $('clear-stage'), clearPanel: $('clear-panel'),
  sound: $('sound-btn'),
};

const world = new World(canvas);
// 和紙のざらつきを画面全体にうっすら重ねる
$('paper').style.backgroundImage = `url(${paperDataURL()})`;
const input = new Input((cx, cy) => world.screenToRiverX(cx, cy, window.innerWidth, window.innerHeight));

type Screen = 'title' | 'playing' | 'paused' | 'result' | 'clear';
let screen: Screen = 'title';
let sim = new Sim();
let sinceRecover = 99;
let overTimer = -1; // 転覆しきってから結果画面を出すまでの間
let resultShownAt = 0;
let rotateBlock = false; // スマホを縦に持っていて止めている

// ---- 文面（src/config.ts） ----
$('game-title').textContent = GAME_TITLE;
$('subtitle').textContent = SUBTITLE;
$('how-to').textContent = HOW_TO;
document.querySelectorAll('.story-text').forEach((el) => (el.textContent = STORY_TEXT));
document.querySelectorAll<HTMLAnchorElement>('.shop-link').forEach((a) => (a.href = SHOP_URL));

// ---- 残り回数（小さな達磨のアイコン） ----
const DARUMA_ICON = '<svg viewBox="0 0 22 24"><ellipse cx="11" cy="14" rx="9" ry="9.5" fill="#c0392b"/><circle cx="11" cy="11" r="4.6" fill="#f2e6d0"/><circle cx="9.3" cy="10.6" r="0.9" fill="#222"/><circle cx="12.7" cy="10.6" r="0.9" fill="#222"/></svg>';
ui.lives.innerHTML = DARUMA_ICON.repeat(MAX_LIVES);
const lifeIcons = Array.from(ui.lives.querySelectorAll('svg'));

function show(next: Screen) {
  screen = next;
  ui.title.hidden = next !== 'title';
  ui.pause.hidden = next !== 'paused';
  ui.result.hidden = next !== 'result';
  ui.clear.hidden = next !== 'clear';
  ui.hud.hidden = next === 'title' || next === 'clear';
}

function startGame() {
  clearTimeout(artTimer);
  sim = new Sim();
  world.reset();
  input.reset();
  sinceRecover = 99;
  overTimer = -1;
  show('playing');
}

function toTitle() {
  clearTimeout(artTimer);
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

/** 途中で終わったとき（3.4） */
function showResult() {
  const { best, isNew } = recordRun({ cleared: false, washi: sim.washi });
  $('r-washi').textContent = String(sim.washi);
  $('b-washi').textContent = String(best.washi);
  $('r-washi-new').hidden = !isNew.washi;
  $('r-cheer').textContent = `あと${WASHI_GOAL - sim.washi}畳で大だるまが描けます`; // 【仮】
  $<HTMLAnchorElement>('share-btn').href = shareUrl(shareTextPartial(sim.washi));
  resultShownAt = performance.now();
  show('result');
}

// ---- クリア：大だるま絵が描き上がる（ステップ5では仮の絵）→ クリア画面（3.3、第5章） ----
const ART_TIME = 6500; // 描き上がるまでの時間（ミリ秒）
let artTimer = 0;
function showClear() {
  const { best, isNew } = recordRun({ cleared: true, washi: sim.washi, clearTime: sim.clearTime, lives: sim.lives });
  $('c-time').textContent = formatTime(sim.clearTime);
  $('c-lives').textContent = String(sim.lives);
  $('cb-time').textContent = best.clearTime ? formatTime(best.clearTime) : '-';
  $('cb-lives').textContent = String(best.lives);
  $('c-time-new').hidden = !isNew.clearTime;
  $('c-lives-new').hidden = !isNew.lives;
  $<HTMLAnchorElement>('c-share-btn').href = shareUrl(shareTextClear(sim.clearTime));
  // 絵を描きはじめからやり直す
  ui.clearStage.classList.remove('drawing', 'done');
  void ui.clearStage.offsetWidth;
  ui.clearStage.classList.add('drawing');
  ui.clearPanel.hidden = true;
  show('clear');
  artTimer = window.setTimeout(finishArt, ART_TIME);
}
function finishArt() {
  clearTimeout(artTimer);
  ui.clearStage.classList.add('done');
  ui.clearPanel.hidden = false;
  resultShownAt = performance.now();
}
/** 演出は画面をタップすると飛ばせる */
ui.clear.addEventListener('pointerdown', () => {
  if (screen === 'clear' && ui.clearPanel.hidden) finishArt();
});

// ---- ボタンと操作 ----
$('start-btn').addEventListener('click', startGame);
$('pause-btn').addEventListener('click', pause);
$('resume-btn').addEventListener('click', resume);
$('quit-btn').addEventListener('click', toTitle);
$('retry-btn').addEventListener('click', startGame);
$('title-btn').addEventListener('click', toTitle);
$('c-retry-btn').addEventListener('click', startGame);
$('c-title-btn').addEventListener('click', toTitle);

let soundOn = loadSound();
function updateSoundLabel() {
  ui.sound.textContent = soundOn ? '音：オン' : '音：オフ';
  ui.sound.setAttribute('aria-pressed', String(soundOn));
}
updateSoundLabel();
ui.sound.addEventListener('click', () => {
  soundOn = !soundOn; // 音そのものは第8章が決まってから入れる。いまは設定の切り替えと保存だけ
  saveSound(soundOn);
  updateSoundLabel();
});

input.onTap = () => {
  if (screen === 'title' && !rotateBlock) startGame(); // タイトルはどこを押しても開始
};
input.onKey = (key) => {
  if (rotateBlock) return;
  const ready = performance.now() - resultShownAt > 800;
  if (screen === 'title' && key !== 'Escape') startGame();
  else if (screen === 'playing' && (key === 'Escape' || key === 'p' || key === 'P')) pause();
  else if (screen === 'paused' && [' ', 'Enter', 'Escape', 'p', 'P'].includes(key)) resume();
  else if (screen === 'result' && (key === ' ' || key === 'Enter') && ready) startGame();
  else if (screen === 'clear' && ui.clearPanel.hidden) finishArt();
  else if (screen === 'clear' && (key === ' ' || key === 'Enter') && ready) startGame();
};
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---- 重い端末向けの自動調整 ----
const isTouch = window.matchMedia('(pointer: coarse)').matches;
// 確認用：アドレスの末尾に ?q=0〜2 を付けると、その画質に固定する（自動調整しない）
const fixedQ = new URLSearchParams(location.search).get('q');
const fixedLevel = fixedQ !== null && ['0', '1', '2'].includes(fixedQ) ? (Number(fixedQ) as Level) : null;
const quality = new QualityController(fixedLevel ?? initialLevel(isTouch));
world.setQuality(SETTINGS[quality.level]);

/** 拾った和紙が、画面上部の「和紙 〇〇／120」へ吸い込まれていく */
function flyWashi(x: number, z: number) {
  const from = world.toScreen(x, 0.2, z, window.innerWidth, window.innerHeight);
  const to = ui.washiCount.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'fly-washi';
  el.style.transform = `translate(${from.x}px, ${from.y}px) rotate(15deg)`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = `translate(${to.left + to.width / 2}px, ${to.top + to.height / 2}px) scale(0.5) rotate(-20deg)`;
    el.style.opacity = '0.3';
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
function updateHud(t: number) {
  ui.washiCount.textContent = String(sim.washi);
  lifeIcons.forEach((el, i) => el.classList.toggle('lost', i >= sim.lives));
  // 念珠の無敵の残り時間（切れる2秒前から点滅）
  ui.glow.hidden = !sim.glowing;
  if (sim.glowing) {
    ui.glowBar.style.width = `${(sim.glowT / GLOW_TIME) * 100}%`;
    ui.glowSec.textContent = String(Math.ceil(sim.glowT));
    ui.glow.classList.toggle('warn', sim.glowT <= GLOW_WARN && Math.sin(t * Math.PI * 8) > 0);
  }
}

function step(dt: number) {
  if (screen !== 'playing' || rotateBlock) return;
  input.update(dt);
  sinceRecover += dt;
  for (const e of sim.update(dt, input.targetX)) {
    if (e.type === 'collect') {
      world.collect(e.washi);
      flyWashi(e.washi.x, -e.washi.z);
      ui.score.classList.remove('pulse');
      void ui.score.offsetWidth; // アニメーションをやり直すため
      ui.score.classList.add('pulse');
    } else if (e.type === 'nenju') {
      world.nenju(e.nenju);
    } else if (e.type === 'capsize') {
      world.splash(sim.player.x, -sim.distance, true);
    } else if (e.type === 'recover') {
      sinceRecover = 0;
      world.splash(sim.player.x, -sim.distance, false);
    } else if (e.type === 'wave') {
      toast('大波');
    } else if (e.type === 'gameover') {
      overTimer = 0.6;
    } else if (e.type === 'clear') {
      showClear();
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
  updateHud(t);
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
  get glowing() { return world.glowing; },
  get artDone() { return !ui.clearPanel.hidden; },
};
