import { describe, it, expect } from 'vitest';
import {
  Sim, SimEvent, MAX_LIVES, WASHI_GOAL, CAPSIZE_TIME, INVULN_TIME, WAVE_TIME, WAVE_CONTROL, GLOW_TIME,
} from '../src/game/sim';
import { Row, Rock, Log, Whirl, Wave, logX } from '../src/game/course';
import { autopilotTarget } from './autopilot';

const DT = 1 / 60;

/** 障害物のない状態から始めて、テストごとに置きたいものだけ置く */
function emptySim(): Sim {
  const s = new Sim(1);
  s.course.rows = [];
  s.course.washi = [];
  s.course.nenjus = [];
  s.course.currents = [];
  return s;
}
function addRock(s: Sim, x: number, z: number, r = 0.5) {
  const rock: Rock = { kind: 'rock', x, z, r };
  s.course.rows.push({ z, type: 'rocks', gapX: 0, obstacles: [rock] } as Row);
}
function run(s: Sim, seconds: number, targetX = 0): SimEvent[] {
  const ev: SimEvent[] = [];
  for (let t = 0; t < seconds; t += DT) ev.push(...s.update(DT, targetX));
  return ev;
}
const types = (ev: SimEvent[]) => ev.map((e) => e.type);

describe('転覆と七転び八起き', () => {
  it('岩にぶつかると転覆し、しばらくして葉に戻ると残り回数が1つ減る', () => {
    const s = emptySim();
    addRock(s, 0, 6);
    const ev = run(s, 1);
    expect(ev).toContainEqual({ type: 'capsize', cause: 'rock' });
    expect(s.phase).toBe('capsized');
    expect(s.lives).toBe(MAX_LIVES);
    const d = s.distance;
    run(s, 0.2);
    expect(s.distance).toBe(d); // 転覆中は前に進まない
    expect(types(run(s, CAPSIZE_TIME))).toContain('recover');
    expect(s.lives).toBe(MAX_LIVES - 1);
    expect(s.phase).toBe('playing');
  });

  it('戻った直後の2秒間はぶつかっても転覆しない。そのあとは転覆する', () => {
    const s = emptySim();
    addRock(s, 0, 6);
    run(s, 1);
    run(s, CAPSIZE_TIME);
    expect(s.invulnerable).toBe(true);
    addRock(s, 0, s.distance + 3); // 無敵の間に当たる位置
    expect(types(run(s, INVULN_TIME - 0.1))).not.toContain('capsize');
    addRock(s, 0, s.distance + 4); // 無敵が切れたあと当たる位置
    expect(types(run(s, 1))).toContain('capsize');
  });

  it('残り回数がない状態で転覆すると、ゲーム終了', () => {
    const s = emptySim();
    s.lives = 0;
    addRock(s, 0, 6);
    run(s, 1);
    const ev = run(s, CAPSIZE_TIME + 0.1);
    expect(types(ev)).toContain('gameover');
    expect(s.phase).toBe('over');
    const d = s.distance;
    expect(run(s, 1)).toEqual([]); // 終了後は何も起きない
    expect(s.distance).toBe(d);
  });

  it('七転び八起き：3回まで戻れて、4回目の転覆で終わる', () => {
    const s = emptySim();
    let capsizes = 0;
    for (let i = 0; i < 10 && s.phase !== 'over'; i++) {
      addRock(s, 0, s.distance + 6);
      const ev = run(s, 1 + CAPSIZE_TIME + INVULN_TIME);
      capsizes += ev.filter((e) => e.type === 'capsize').length;
    }
    expect(s.phase).toBe('over');
    expect(capsizes).toBe(MAX_LIVES + 1);
  });
});

describe('流木・渦・大波', () => {
  it('流木にぶつかると転覆する。離れていれば平気', () => {
    const s = emptySim();
    const log: Log = { kind: 'log', z: 8, x0: 0, vx: 0, half: 1.5, r: 0.28 };
    s.course.rows.push({ z: 8, type: 'log', gapX: 0, obstacles: [log] });
    expect(run(s, 1.5)).toContainEqual({ type: 'capsize', cause: 'log' });

    const s2 = emptySim();
    const far: Log = { kind: 'log', z: 8, x0: 4, vx: 0, half: 1.5, r: 0.28 };
    s2.course.rows.push({ z: 8, type: 'log', gapX: 0, obstacles: [far] });
    expect(types(run(s2, 1.5))).not.toContain('capsize');
  });

  it('流木は時間とともに横へ流れる', () => {
    const log: Log = { kind: 'log', z: 8, x0: -3, vx: 2, half: 1.5, r: 0.28 };
    expect(logX(log, 0)).toBe(-3);
    expect(logX(log, 1.5)).toBe(0);
  });

  it('渦：近づくと中心へ引き寄せられ、中心に入ると転覆する', () => {
    const s = emptySim();
    const w: Whirl = { kind: 'whirl', x: 1.6, z: 12, pull: 3, core: 0.55, spin: 1 };
    s.course.rows.push({ z: 12, type: 'whirl', gapX: 0, obstacles: [w] });
    let maxX = 0;
    let capsized = false;
    for (let t = 0; t < 2 && !capsized; t += DT) {
      capsized = s.update(DT, 0).some((e) => e.type === 'capsize');
      maxX = Math.max(maxX, s.player.x);
    }
    expect(maxX).toBeGreaterThan(0.3); // 操作していないのに渦の方へ寄った
  });

  it('渦：真ん中に突っ込むと転覆', () => {
    const s = emptySim();
    const w: Whirl = { kind: 'whirl', x: 0, z: 10, pull: 3, core: 0.55, spin: 1 };
    s.course.rows.push({ z: 10, type: 'whirl', gapX: 0, obstacles: [w] });
    expect(run(s, 2)).toContainEqual({ type: 'capsize', cause: 'whirl' });
  });

  it('渦：うまく横切れば抜けられる', () => {
    const s = emptySim();
    s.player.x = 3.5;
    const w: Whirl = { kind: 'whirl', x: 0, z: 10, pull: 3, core: 0.55, spin: 1 };
    s.course.rows.push({ z: 10, type: 'whirl', gapX: 3.5, obstacles: [w] });
    expect(types(run(s, 3, 4))).not.toContain('capsize');
  });

  it('大波：揺れて、しばらく操作が効きにくくなる（転覆はしない）', () => {
    const s = emptySim();
    const wave: Wave = { kind: 'wave', z0: 10, speed: 3, hit: false };
    s.course.rows.push({ z: 10, type: 'wave', gapX: 0, obstacles: [wave] });
    const ev = run(s, 1.5);
    expect(types(ev)).toContain('wave');
    expect(types(ev)).not.toContain('capsize');
    expect(s.control).toBe(WAVE_CONTROL);
    run(s, WAVE_TIME);
    expect(s.control).toBe(1);
  });
});

describe('横向きの流れ', () => {
  it('流れのある場所では、操作しなくても葉が横へ押される', () => {
    const s = emptySim();
    s.course.currents = [{ z0: 0, z1: 200, strength: 2 }];
    run(s, 2);
    expect(s.player.x).toBeGreaterThan(0.4);
  });
});

const washiAt = (x: number, z: number, id = 1) => ({ id, x, z, taken: false });

describe('和紙（120枚でクリア）', () => {
  it('葉で触れると拾え、枚数が増える。離れたものは拾わない', () => {
    const s = emptySim();
    s.course.washi = [washiAt(0, 5, 1), washiAt(0.3, 7, 2), washiAt(4, 7, 3)];
    const ev = run(s, 1.5);
    expect(ev.filter((e) => e.type === 'collect')).toHaveLength(2);
    expect(s.washi).toBe(2);
  });

  it('120枚目を拾うとクリア：ゲームが止まり、かかった時間が残る', () => {
    const s = emptySim();
    s.washi = WASHI_GOAL - 1;
    s.course.washi = [washiAt(0, 5)];
    const ev = run(s, 1.5);
    expect(types(ev)).toContain('clear');
    expect(s.washi).toBe(WASHI_GOAL);
    expect(s.phase).toBe('cleared');
    expect(s.clearTime).toBeGreaterThan(0.3);
    expect(s.clearTime).toBeLessThan(1.5);
    const d = s.distance;
    expect(run(s, 1)).toEqual([]); // クリア後は何も起きない
    expect(s.distance).toBe(d);
  });

  it('転覆しても拾った和紙は減らない', () => {
    const s = emptySim();
    s.course.washi = [washiAt(0, 3)];
    addRock(s, 0, 8);
    run(s, 1 + CAPSIZE_TIME);
    expect(s.washi).toBe(1);
  });
});

describe('念珠（お助けアイテム）', () => {
  const nenjuAt = (x: number, z: number, id = 1) => ({ id, x, z, taken: false });

  it('拾うと8秒の無敵になり、岩にぶつかっても転覆せずにすり抜ける', () => {
    const s = emptySim();
    s.course.nenjus = [nenjuAt(0, 4)];
    addRock(s, 0, 15);
    addRock(s, 0, 30);
    const ev = run(s, 3);
    expect(types(ev)).toContain('nenju');
    expect(types(ev)).toContain('pass');
    expect(types(ev)).not.toContain('capsize');
    expect(s.glowing).toBe(true);
    expect(s.phase).toBe('playing');
  });

  it('流木と渦もすり抜け、渦に引き寄せられない', () => {
    const s = emptySim();
    s.glowT = GLOW_TIME;
    const log: Log = { kind: 'log', z: 8, x0: 0, vx: 0, half: 1.5, r: 0.28 };
    const w: Whirl = { kind: 'whirl', x: 1.5, z: 22, pull: 3, core: 0.55, spin: 1 };
    s.course.rows.push({ z: 8, type: 'log', gapX: 0, obstacles: [log] }, { z: 22, type: 'whirl', gapX: 0, obstacles: [w] });
    let maxX = 0;
    const ev: SimEvent[] = [];
    for (let t = 0; t < 3; t += DT) { ev.push(...s.update(DT, 0)); maxX = Math.max(maxX, s.player.x); }
    expect(types(ev)).not.toContain('capsize');
    expect(maxX).toBeLessThan(0.05);
  });

  it('大波の揺れは無敵中も残る', () => {
    const s = emptySim();
    s.glowT = GLOW_TIME;
    const wave: Wave = { kind: 'wave', z0: 10, speed: 3, hit: false };
    s.course.rows.push({ z: 10, type: 'wave', gapX: 0, obstacles: [wave] });
    expect(types(run(s, 1.5))).toContain('wave');
    expect(s.control).toBe(WAVE_CONTROL);
  });

  it('8秒たつと無敵が切れ、また岩で転覆する', () => {
    const s = emptySim();
    s.course.nenjus = [nenjuAt(0, 4)];
    run(s, 0.6);
    expect(s.glowing).toBe(true);
    run(s, GLOW_TIME);
    expect(s.glowing).toBe(false);
    addRock(s, 0, s.distance + 6);
    expect(types(run(s, 1))).toContain('capsize');
  });

  it('無敵中にもう一つ拾うと、残り時間がはじめからに戻る', () => {
    const s = emptySim();
    s.course.nenjus = [nenjuAt(0, 4, 1)];
    run(s, 0.6);
    run(s, 5);
    expect(s.glowT).toBeLessThan(GLOW_TIME - 4);
    s.course.nenjus.push(nenjuAt(0, s.distance + 4, 2));
    run(s, 0.6);
    expect(s.glowT).toBeGreaterThan(GLOW_TIME - 0.6);
  });
});

/** 自動操縦で、終わるまで遊ぶ */
function playThrough(seed: number) {
  const s = new Sim(seed);
  let capsizes = 0;
  let nenju = 0;
  while (s.phase !== 'over' && s.phase !== 'cleared' && s.time < 900) {
    for (const e of s.update(DT, autopilotTarget(s))) {
      if (e.type === 'capsize') capsizes++;
      if (e.type === 'nenju') nenju++;
    }
  }
  return { s, capsizes, nenju };
}

describe('通しで遊ぶ（自動操縦）', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const runs = seeds.map((seed) => ({ seed, ...playThrough(seed) }));

  it('障害物を避けながら和紙を拾い続ければ、120枚集めてクリアできる', () => {
    for (const r of runs) {
      expect(r.s.phase, `seed=${r.seed} 和紙=${r.s.washi} 転覆=${r.capsizes}`).toBe('cleared');
      expect(r.s.washi).toBe(WASHI_GOAL);
    }
  });

  it('クリアまでの長さ：上手な操縦で約3分（2分30秒〜4分の範囲）', () => {
    const times = runs.map((r) => r.s.clearTime);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.info(`クリアまでの時間（自動操縦）: ${times.map((t) => t.toFixed(0)).join(', ')} 秒／平均 ${avg.toFixed(0)} 秒`);
    expect(avg).toBeGreaterThan(150);
    expect(avg).toBeLessThan(240);
  });

  it('念珠は1プレイに3〜4回ほど出てくる', () => {
    for (const r of runs) {
      expect(r.nenju, `seed=${r.seed}`).toBeGreaterThanOrEqual(2);
      expect(r.nenju, `seed=${r.seed}`).toBeLessThanOrEqual(5);
    }
  });
});
