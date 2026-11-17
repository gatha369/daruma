// コース（障害物・念珠の珠・横向きの流れ）の作り方
import {
  RIVER_HALF_WIDTH, Rng, clamp, difficultyAt, smoothstep, speedAt,
} from './logic';

// ---- 種類ごとの形 ----
export interface Rock { kind: 'rock'; x: number; z: number; r: number }
/** 流木：横向きに流れる。位置 x は時刻 time から logX() で求める */
export interface Log { kind: 'log'; z: number; x0: number; vx: number; half: number; r: number }
/** 渦：pull の範囲で中心へ引き寄せ、core に入ると転覆 */
export interface Whirl { kind: 'whirl'; x: number; z: number; pull: number; core: number; spin: number }
/** 大波：前方からこちらへ向かってくる。位置 z は waveZ() で求める */
export interface Wave { kind: 'wave'; z0: number; speed: number; hit: boolean }
export type Obstacle = Rock | Log | Whirl | Wave;

export interface Bead { id: number; x: number; z: number; taken: boolean }
export interface Current { z0: number; z1: number; strength: number }

export type RowType = 'rocks' | 'log' | 'whirl' | 'wave';
export interface Row { z: number; type: RowType; gapX: number; obstacles: Obstacle[] }

export const logX = (l: Log, time: number) => l.x0 + l.vx * time;
export const waveZ = (w: Wave, time: number) => w.z0 - w.speed * time;

// ---- 調整用の値 ----
export const ROW_SPACING = 14; // 列と列の前後の間隔
export const GAP_WIDTH = 3.2; // 岩の列に必ず残す通り抜けの隙間（岩の縁から縁まで）
export const MAX_GAP_SHIFT = 4; // 列ごとに隙間がずれる最大量
export const WHIRL_PULL = 3.0;
export const WHIRL_CORE = 0.55;
export const WAVE_SPEED = 3;
/** 各障害物が出始める距離（最初の10秒ほどは岩だけにする） */
export const INTRO = { log: 90, current: 150, whirl: 200, wave: 320 };
/** その列のあとに空ける追加の間隔 */
const EXTRA_SPACE: Record<RowType, number> = { rocks: 0, log: 4, whirl: 6, wave: 14 };

/** 岩の列。どの列にも必ず隙間を1つ残し、隙間は前の列から移動できる範囲だけずらす */
export function makeRockRow(z: number, prevGapX: number, level: number, rng: Rng): Row {
  const lim = RIVER_HALF_WIDTH - GAP_WIDTH / 2;
  const gapX = clamp(prevGapX + (rng() * 2 - 1) * MAX_GAP_SHIFT, -lim, lim);
  const fillChance = 0.25 + 0.55 * level;
  const obstacles: Rock[] = [];
  const step = 1.6;
  for (let cx = -RIVER_HALF_WIDTH; cx <= RIVER_HALF_WIDTH + 0.01; cx += step) {
    if (rng() > fillChance) continue;
    const r = 0.45 + rng() * 0.35;
    const x = cx + (rng() - 0.5) * 0.4;
    if (Math.abs(x - gapX) < GAP_WIDTH / 2 + r) continue; // 隙間に食い込むなら置かない
    obstacles.push({ kind: 'rock', x, z: z + (rng() - 0.5) * 2, r });
  }
  return { z, type: 'rocks', gapX, obstacles };
}

/** 生成時に必要な「いまの状況」（流木・大波がいつ葉の前に来るかを合わせるため） */
export interface Now { time: number; distance: number }

/** 葉がその位置に着くおおよその時刻 */
function arrivalTime(z: number, now: Now): number {
  const v = (speedAt(now.distance) + speedAt(z)) / 2;
  return now.time + Math.max(0, z - now.distance) / v;
}

export function makeWhirlRow(z: number, prevGapX: number, rng: Rng): Row {
  // 渦は前の隙間とは反対側に置き、前の隙間の側に安全な通り道を残す
  const side = prevGapX > 0 ? -1 : prevGapX < 0 ? 1 : rng() < 0.5 ? -1 : 1;
  const wx = clamp(prevGapX + side * (WHIRL_PULL + 0.8 + rng() * 1.5), -3.2, 3.2);
  const laneEdge = wx - side * WHIRL_PULL; // 引き込まれ範囲の端
  const laneMid = (laneEdge + -side * RIVER_HALF_WIDTH) / 2;
  const gapX = Math.abs(prevGapX - wx) >= WHIRL_PULL + 0.3 ? prevGapX : laneMid;
  const whirl: Whirl = { kind: 'whirl', x: wx, z, pull: WHIRL_PULL, core: WHIRL_CORE, spin: rng() < 0.5 ? 1 : -1 };
  return { z, type: 'whirl', gapX, obstacles: [whirl] };
}

export function makeLogRow(z: number, prevGapX: number, level: number, rng: Rng, now: Now): Row {
  const half = 1.3 + rng() * 0.6;
  const speed = 1.5 + 1.5 * level;
  const vx = rng() < 0.5 ? speed : -speed;
  const xAtArrival = (rng() * 2 - 1) * 4; // 葉が着く頃に流木がいる位置
  const x0 = xAtArrival - vx * arrivalTime(z, now);
  const log: Log = { kind: 'log', z, x0, vx, half, r: 0.28 };
  return { z, type: 'log', gapX: prevGapX, obstacles: [log] };
}

export function makeWaveRow(z: number, prevGapX: number, now: Now): Row {
  // 葉と出会う位置がだいたい z になるように、最初はもっと先に置く
  const z0 = z + WAVE_SPEED * arrivalTime(z, now);
  const wave: Wave = { kind: 'wave', z0, speed: WAVE_SPEED, hit: false };
  return { z, type: 'wave', gapX: prevGapX, obstacles: [wave] };
}

/** 珠の位置が障害物に重ならないか */
export function beadIsSafe(x: number, z: number, rows: Row[], margin = 0.45): boolean {
  if (Math.abs(x) > RIVER_HALF_WIDTH - 0.2) return false;
  for (const row of rows) {
    for (const o of row.obstacles) {
      if (o.kind === 'rock' && Math.hypot(o.x - x, o.z - z) < o.r + margin) return false;
      if (o.kind === 'whirl' && Math.hypot(o.x - x, o.z - z) < o.core + margin + 0.4) return false;
    }
  }
  return true;
}

export class Course {
  rows: Row[] = [];
  beads: Bead[] = [];
  currents: Current[] = [];
  private nextZ: number;
  private lastGapX = 0;
  private lastType: RowType = 'rocks';
  private nextCurrentZ = INTRO.current;
  private beadId = 0;

  constructor(private rng: Rng, firstRowZ = 30) {
    this.nextZ = firstRowZ;
  }

  /** upTo の距離まで、コースを先に作っておく */
  ensure(upTo: number, now: Now) {
    while (this.nextZ < upTo) this.addRow(now);
    while (this.nextCurrentZ < upTo) this.addCurrent();
  }

  /** 後ろに流れたものを片付ける */
  prune(behind: number) {
    this.rows = this.rows.filter((r) => r.z > behind || (r.type === 'wave' && !(r.obstacles[0] as Wave).hit));
    this.beads = this.beads.filter((b) => b.z > behind);
    this.currents = this.currents.filter((c) => c.z1 > behind);
  }

  /** その位置の横向きの流れ（＋で右へ押す）。区間の端はなめらかに強弱をつける */
  currentAt(z: number): number {
    for (const c of this.currents) {
      if (z >= c.z0 && z <= c.z1) {
        const edge = Math.min(z - c.z0, c.z1 - z);
        return c.strength * smoothstep(clamp(edge / 6, 0, 1));
      }
    }
    return 0;
  }

  private chooseType(z: number): RowType {
    if (this.lastType !== 'rocks') return 'rocks'; // 特別な障害物は続けて出さない
    const lv = difficultyAt(z);
    const w: [RowType, number][] = [
      ['rocks', 1],
      ['log', z >= INTRO.log ? 0.2 + 0.3 * lv : 0],
      ['whirl', z >= INTRO.whirl ? 0.12 + 0.25 * lv : 0],
      ['wave', z >= INTRO.wave ? 0.08 + 0.12 * lv : 0],
    ];
    let t = this.rng() * w.reduce((s, [, v]) => s + v, 0);
    for (const [type, v] of w) {
      if ((t -= v) < 0) return type;
    }
    return 'rocks';
  }

  private addRow(now: Now) {
    const z = this.nextZ;
    const lv = difficultyAt(z);
    const type = this.chooseType(z);
    const prev = this.rows[this.rows.length - 1];
    const prevZ = prev ? prev.z : z - ROW_SPACING;
    let row: Row;
    if (type === 'whirl') row = makeWhirlRow(z, this.lastGapX, this.rng);
    else if (type === 'log') row = makeLogRow(z, this.lastGapX, lv, this.rng, now);
    else if (type === 'wave') row = makeWaveRow(z, this.lastGapX, now);
    else row = makeRockRow(z, this.lastGapX, lv, this.rng);
    this.rows.push(row);
    this.addBeads(row, prevZ, this.lastGapX, lv);
    this.lastGapX = row.gapX;
    this.lastType = type;
    this.nextZ = z + ROW_SPACING + EXTRA_SPACE[type];
  }

  private pushBead(x: number, z: number) {
    if (beadIsSafe(x, z, this.rows.slice(-3))) {
      this.beads.push({ id: this.beadId++, x, z, taken: false });
    }
  }

  /** 珠を置く。弧の並び・1個ずつ・障害物のそば（危ないところほど多め） */
  private addBeads(row: Row, prevZ: number, prevGapX: number, lv: number) {
    const rng = this.rng;
    if (row.type === 'rocks' || row.type === 'wave') {
      // 前の通り道から、この列の隙間へと弧を描く並び（なぞると気持ちよく拾える）
      if (rng() < 0.6) {
        const n = 5 + Math.floor(rng() * 3);
        const z0 = prevZ + 4;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          this.pushBead(prevGapX + (row.gapX - prevGapX) * smoothstep(t), z0 + (row.z - z0) * t);
        }
      } else if (rng() < 0.5) {
        this.pushBead(row.gapX, row.z - 5);
      }
    }
    if (row.type === 'rocks') {
      // 岩のすぐそばの1個（危険を冒すと得をする）
      const rocks = row.obstacles as Rock[];
      if (rocks.length && rng() < 0.3 + 0.3 * lv) {
        const rock = rocks[Math.floor(rng() * rocks.length)];
        const side = rng() < 0.5 ? -1 : 1;
        this.pushBead(rock.x + side * (rock.r + 0.75), rock.z);
      }
    } else if (row.type === 'whirl') {
      // 渦の引き込み範囲の中、通り道の側に半円の並び
      const w = row.obstacles[0] as Whirl;
      const toward = Math.sign(row.gapX - w.x) || 1;
      for (let i = 0; i < 5; i++) {
        const a = (-0.5 + i / 4) * Math.PI * 0.9;
        this.pushBead(w.x + toward * Math.cos(a) * 1.8, w.z + Math.sin(a) * 1.8);
      }
    } else if (row.type === 'log') {
      // 流木の通り道の上に縦に3個
      const x = (rng() * 2 - 1) * 3.5;
      for (let i = -1; i <= 1; i++) this.pushBead(x, row.z + i * 1.2);
    }
  }

  private addCurrent() {
    const rng = this.rng;
    const z0 = this.nextCurrentZ;
    const len = 25 + rng() * 30;
    const lv = difficultyAt(z0);
    const strength = (rng() < 0.5 ? -1 : 1) * (1 + 1.6 * lv);
    this.currents.push({ z0, z1: z0 + len, strength });
    this.nextCurrentZ = z0 + len + 30 + rng() * 40; // 流れのない区間をはさむ
  }
}
