// 1回のプレイの進行（前進・操作・障害物・転覆・珠）。画面表示とは切り離してある
import {
  Player, Rng, makeRng, speedAt, stepPlayer, leafHitsCircle, leafHitsLog, leafCircles,
  LEAF_HIT_RADIUS,
} from './logic';
import { Course, Bead, Log, Rock, Wave, Whirl, logX, waveZ } from './course';

export const MAX_LIVES = 3; // 転覆から戻れる回数（仮：3回）
export const ROSARY_SIZE = 108; // 一連の念珠の珠の数
export const CAPSIZE_TIME = 1.6; // 落ちてから葉に戻るまでの時間
export const INVULN_TIME = 2; // 戻った直後に転覆しない時間
export const WAVE_TIME = 2.5; // 大波を受けて操作が効きにくい時間
export const WAVE_CONTROL = 0.3; // そのあいだの操作の効き具合
export const CURRENT_FORCE = 8; // 横向きの流れが葉を押す強さ
export const WHIRL_FORCE = 30; // 渦が引き寄せる強さ（中心に近いほど強い）
export const BEAD_RADIUS = 0.2;
export const LOOK_AHEAD = 150; // どこまで先のコースを作っておくか

export type Cause = 'rock' | 'log' | 'whirl';
export type SimEvent =
  | { type: 'capsize'; cause: Cause }
  | { type: 'recover' }
  | { type: 'collect'; bead: Bead }
  | { type: 'rosary' }
  | { type: 'wave' }
  | { type: 'gameover' };

export type SimPhase = 'playing' | 'capsized' | 'over';

export class Sim {
  time = 0;
  distance = 0;
  player: Player = { x: 0, vx: 0, targetX: 0 };
  phase: SimPhase = 'playing';
  lives = MAX_LIVES;
  beads = 0; // いま編んでいる念珠の珠の数（0〜107）
  rosaries = 0; // 完成した念珠の数
  totalBeads = 0; // このプレイで拾った珠の合計
  capsizeT = 0;
  invulnT = 0;
  waveT = 0;
  course: Course;
  private rng: Rng;

  constructor(seed = Date.now()) {
    this.rng = makeRng(seed);
    this.course = new Course(makeRng(seed * 7 + 1));
    this.course.ensure(LOOK_AHEAD, { time: 0, distance: 0 });
  }

  get speed() { return speedAt(this.distance); }
  get invulnerable() { return this.invulnT > 0; }
  /** いま操作がどれだけ効くか（大波のあとは下がる） */
  get control() { return this.waveT > 0 ? WAVE_CONTROL : 1; }

  /** 渦が葉を引き寄せる横向きの力 */
  whirlPush(): number {
    let push = 0;
    for (const w of this.nearby<Whirl>('whirl', WHIRL_PULL_RANGE)) {
      const d = Math.hypot(w.x - this.player.x, w.z - this.distance);
      if (d < w.pull) push += Math.sign(w.x - this.player.x) * WHIRL_FORCE * (1 - d / w.pull);
    }
    return push;
  }

  update(dt: number, targetX: number): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.phase === 'over') return ev;
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
    this.waveT = Math.max(0, this.waveT - dt);
    this.course.ensure(this.distance + LOOK_AHEAD, { time: this.time, distance: this.distance });
    this.course.prune(this.distance - 20);

    const { x } = this.player;
    const z = this.distance;

    // ---- 大波：横切ると大きく揺れて、しばらく操作が効きにくい ----
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

    // ---- 念珠の珠を拾う ----
    for (const b of this.course.beads) {
      if (b.taken || Math.abs(b.z - z) > 2) continue;
      const near = leafCircles(x, z).some(([cx, cz]) =>
        Math.hypot(b.x - cx, b.z - cz) < BEAD_RADIUS + LEAF_HIT_RADIUS + 0.25);
      if (!near) continue;
      b.taken = true;
      this.beads += 1;
      this.totalBeads += 1;
      ev.push({ type: 'collect', bead: b });
      if (this.beads >= ROSARY_SIZE) {
        this.beads = 0;
        this.rosaries += 1;
        this.lives = Math.min(MAX_LIVES, this.lives + 1); // ご褒美（仮）：1回回復
        ev.push({ type: 'rosary' });
      }
    }

    // ---- 障害物にぶつかったら転覆 ----
    if (!this.invulnerable) {
      const cause = this.findHit();
      if (cause) {
        this.phase = 'capsized';
        this.capsizeT = CAPSIZE_TIME;
        this.waveT = 0;
        this.player.vx = 0;
        ev.push({ type: 'capsize', cause });
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

  private findHit(): Cause | null {
    const { x } = this.player;
    const z = this.distance;
    for (const r of this.nearby<Rock>('rock', 4)) {
      if (leafHitsCircle(x, z, r.x, r.z, r.r)) return 'rock';
    }
    for (const l of this.nearby<Log>('log', 2)) {
      if (leafHitsLog(x, z, logX(l, this.time), l.z, l.half, l.r)) return 'log';
    }
    for (const w of this.nearby<Whirl>('whirl', WHIRL_PULL_RANGE)) {
      if (Math.hypot(w.x - x, w.z - z) < w.core) return 'whirl';
    }
    return null;
  }
}

const WHIRL_PULL_RANGE = 4;
