// 1回のプレイの進行（前進・操作・障害物・転覆・和紙・念珠）。画面表示とは切り離してある
import {
  Player, Rng, makeRng, speedAt, stepPlayer, leafHitsCircle, leafHitsLog, leafCircles,
  LEAF_HIT_RADIUS,
} from './logic';
import { Course, Washi, Nenju, Log, Rock, Wave, Whirl, logX, waveZ } from './course';

export const MAX_LIVES = 3; // 転覆から戻れる回数（仮：3回）
export const WASHI_GOAL = 120; // 和紙をこの枚数（＝120畳）集めたらクリア
export const CAPSIZE_TIME = 1.6; // 落ちてから葉に戻るまでの時間
export const INVULN_TIME = 2; // 戻った直後に転覆しない時間
export const GLOW_TIME = 8; // 念珠を拾ったときの無敵の長さ【仮：8秒】
export const GLOW_WARN = 2; // 無敵が切れる何秒前から点滅させるか
export const WAVE_TIME = 2.5; // 大波を受けて操作が効きにくい時間
export const WAVE_CONTROL = 0.3; // そのあいだの操作の効き具合
export const CURRENT_FORCE = 8; // 横向きの流れが葉を押す強さ
export const WHIRL_FORCE = 30; // 渦が引き寄せる強さ（中心に近いほど強い）
export const WASHI_SIZE = 0.95; // 和紙の一辺の長さ（見た目）
export const WASHI_RADIUS = 0.42; // 和紙の拾える大きさ
export const NENJU_RADIUS = 0.6; // 念珠の拾える大きさ
export const LOOK_AHEAD = 150; // どこまで先のコースを作っておくか

export type Cause = 'rock' | 'log' | 'whirl';
export type SimEvent =
  | { type: 'capsize'; cause: Cause }
  | { type: 'recover' }
  | { type: 'collect'; washi: Washi }
  | { type: 'nenju'; nenju: Nenju }
  | { type: 'pass'; cause: Cause } // 念珠の無敵中に障害物をすり抜けた
  | { type: 'wave' }
  | { type: 'clear' }
  | { type: 'gameover' };

export type SimPhase = 'playing' | 'capsized' | 'over' | 'cleared';

export class Sim {
  time = 0;
  distance = 0;
  player: Player = { x: 0, vx: 0, targetX: 0 };
  phase: SimPhase = 'playing';
  lives = MAX_LIVES;
  washi = 0; // 集めた和紙の枚数
  clearTime = 0; // クリアまでにかかった時間（秒）
  capsizeT = 0;
  invulnT = 0; // 転覆から戻った直後の無敵
  glowT = 0; // 念珠の無敵（七色に光る）
  waveT = 0;
  course: Course;
  private rng: Rng;
  private passed = new Set<object>(); // すり抜け中の障害物（同じものを何度も数えない）

  constructor(seed = Date.now()) {
    this.rng = makeRng(seed);
    this.course = new Course(makeRng(seed * 7 + 1));
    this.course.ensure(LOOK_AHEAD, { time: 0, distance: 0 });
  }

  get speed() { return speedAt(this.distance); }
  get invulnerable() { return this.invulnT > 0; }
  /** 念珠の無敵中か */
  get glowing() { return this.glowT > 0; }
  /** いま操作がどれだけ効くか（大波のあとは下がる） */
  get control() { return this.waveT > 0 ? WAVE_CONTROL : 1; }
  /** クリアまでの進み具合 0〜1 */
  get progress() { return Math.min(1, this.washi / WASHI_GOAL); }

  /** 渦が葉を引き寄せる横向きの力（念珠の無敵中は効かない） */
  whirlPush(): number {
    if (this.glowing) return 0;
    let push = 0;
    for (const w of this.nearby<Whirl>('whirl', WHIRL_PULL_RANGE)) {
      const d = Math.hypot(w.x - this.player.x, w.z - this.distance);
      if (d < w.pull) push += Math.sign(w.x - this.player.x) * WHIRL_FORCE * (1 - d / w.pull);
    }
    return push;
  }

  update(dt: number, targetX: number): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.phase === 'over' || this.phase === 'cleared') return ev;
    this.time += dt;

    if (this.phase === 'capsized') {
      this.capsizeT -= dt;
      if (this.capsizeT <= 0) {
        if (this.lives > 0) {
          this.lives -= 1; // 戻るたびに残り回数が減る
          this.phase = 'playing';
          this.invulnT = INVULN_TIME;
          this.player = { x: this.player.x, vx: 0, targetX };
          ev.push({ type: 'recover' });
        } else {
          this.phase = 'over';
          ev.push({ type: 'gameover' });
        }
      }
      return ev;
    }

    // ---- 前進と左右の動き ----
    const push = this.course.currentAt(this.distance) * CURRENT_FORCE + this.whirlPush();
    this.player = stepPlayer({ ...this.player, targetX }, dt, { push, control: this.control });
    this.distance += this.speed * dt;
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.glowT = Math.max(0, this.glowT - dt);
    this.waveT = Math.max(0, this.waveT - dt);
    this.course.ensure(this.distance + LOOK_AHEAD, { time: this.time, distance: this.distance });
    this.course.prune(this.distance - 20);

    const { x } = this.player;
    const z = this.distance;
    const touches = (px: number, pz: number, r: number) =>
      Math.abs(pz - z) < 2 && leafCircles(x, z).some(([cx, cz]) => Math.hypot(px - cx, pz - cz) < r + LEAF_HIT_RADIUS + 0.25);

    // ---- 大波：横切ると大きく揺れて、しばらく操作が効きにくい（念珠の無敵中も揺れは残す） ----
    for (const row of this.course.rows) {
      if (row.type !== 'wave') continue;
      const w = row.obstacles[0] as Wave;
      if (!w.hit && z >= waveZ(w, this.time)) {
        w.hit = true;
        this.waveT = WAVE_TIME;
        this.player.vx += (this.rng() < 0.5 ? -1 : 1) * 5;
        ev.push({ type: 'wave' });
      }
    }

    // ---- 念珠を拾う：一定時間 無敵（もう一つ拾ったら、はじめからに戻す） ----
    for (const n of this.course.nenjus) {
      if (n.taken || !touches(n.x, n.z, NENJU_RADIUS)) continue;
      n.taken = true;
      this.glowT = GLOW_TIME;
      ev.push({ type: 'nenju', nenju: n });
    }

    // ---- 和紙を拾う ----
    for (const w of this.course.washi) {
      if (w.taken || !touches(w.x, w.z, WASHI_RADIUS)) continue;
      w.taken = true;
      this.washi += 1;
      ev.push({ type: 'collect', washi: w });
      if (this.washi >= WASHI_GOAL) {
        this.phase = 'cleared';
        this.clearTime = this.time;
        ev.push({ type: 'clear' });
        return ev;
      }
    }

    // ---- 障害物にぶつかったら転覆。念珠の無敵中は、すり抜ける ----
    if (!this.invulnerable) {
      const hit = this.findHit();
      if (hit && this.glowing) {
        if (!this.passed.has(hit.obj)) {
          this.passed.add(hit.obj);
          ev.push({ type: 'pass', cause: hit.cause });
        }
      } else if (hit) {
        this.phase = 'capsized';
        this.capsizeT = CAPSIZE_TIME;
        this.waveT = 0;
        this.player.vx = 0;
        ev.push({ type: 'capsize', cause: hit.cause });
      }
    }
    return ev;
  }

  private nearby<T>(kind: string, range: number): T[] {
    const out: T[] = [];
    for (const row of this.course.rows) {
      if (Math.abs(row.z - this.distance) > range) continue;
      for (const o of row.obstacles) if (o.kind === kind) out.push(o as T);
    }
    return out;
  }

  private findHit(): { cause: Cause; obj: object } | null {
    const { x } = this.player;
    const z = this.distance;
    for (const r of this.nearby<Rock>('rock', 4)) {
      if (leafHitsCircle(x, z, r.x, r.z, r.r)) return { cause: 'rock', obj: r };
    }
    for (const l of this.nearby<Log>('log', 2)) {
      if (leafHitsLog(x, z, logX(l, this.time), l.z, l.half, l.r)) return { cause: 'log', obj: l };
    }
    for (const w of this.nearby<Whirl>('whirl', WHIRL_PULL_RANGE)) {
      if (Math.hypot(w.x - x, w.z - z) < w.core) return { cause: 'whirl', obj: w };
    }
    return null;
  }
}

const WHIRL_PULL_RANGE = 4;
