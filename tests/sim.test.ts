import { describe, it, expect } from 'vitest';
import {
  Sim, SimEvent, MAX_LIVES, ROSARY_SIZE, CAPSIZE_TIME, INVULN_TIME, WAVE_TIME, WAVE_CONTROL,
} from '../src/game/sim';
import { Row, Rock, Log, Whirl, Wave, logX } from '../src/game/course';

const DT = 1 / 60;

/** 障害物のない状態から始めて、テストごとに置きたいものだけ置く */
function emptySim(): Sim {
  const s = new Sim(1);
  s.course.rows = [];
  s.course.beads = [];
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

describe('念珠の珠', () => {
  it('葉で触れると拾え、数が増える', () => {
    const s = emptySim();
    s.course.beads = [{ id: 1, x: 0, z: 5, taken: false }, { id: 2, x: 0.3, z: 7, taken: false }, { id: 3, x: 4, z: 7, taken: false }];
    const ev = run(s, 1.5);
    expect(ev.filter((e) => e.type === 'collect')).toHaveLength(2); // 離れた1個は拾わない
    expect(s.beads).toBe(2);
    expect(s.totalBeads).toBe(2);
  });

  it('108個で一連の念珠が完成：カウントは0に戻り、完成数が1増え、残り回数が1回回復', () => {
    const s = emptySim();
    s.beads = ROSARY_SIZE - 1;
    s.totalBeads = ROSARY_SIZE - 1;
    s.lives = 1;
    s.course.beads = [{ id: 1, x: 0, z: 5, taken: false }];
    expect(types(run(s, 1))).toContain('rosary');
    expect(s.beads).toBe(0);
    expect(s.rosaries).toBe(1);
    expect(s.totalBeads).toBe(ROSARY_SIZE);
    expect(s.lives).toBe(2);
  });

  it('回復は最初の回数まで', () => {
    const s = emptySim();
    s.beads = ROSARY_SIZE - 1;
    s.course.beads = [{ id: 1, x: 0, z: 5, taken: false }];
    run(s, 1);
    expect(s.lives).toBe(MAX_LIVES);
  });

  it('転覆しても拾った珠は減らない', () => {
    const s = emptySim();
    s.course.beads = [{ id: 1, x: 0, z: 3, taken: false }];
    addRock(s, 0, 8);
    run(s, 1 + CAPSIZE_TIME);
    expect(s.beads).toBe(1);
  });
});

describe('通しで遊ぶ（自動操縦）', () => {
  it('道をたどる操縦なら、30里を超えて長く遊べる（どこかに必ず道がある）', () => {
    for (const seed of [1, 2, 3]) {
      const s = new Sim(seed);
      let capsizes = 0;
      while (s.phase !== 'over' && s.distance < 6000) {
        // 少し先の列の通り道を目標にする。流木は着く頃の位置を見て反対側へ
        const next = s.course.rows.find((r) => r.z + 1.5 > s.distance);
        let target = next ? next.gapX : 0;
        if (next?.type === 'log') {
          const l = next.obstacles[0] as Log;
          const eta = (next.z - s.distance) / s.speed;
          const lx = logX(l, s.time + eta);
          if (Math.abs(lx - target) < l.half + 1.2) target = lx > 0 ? lx - l.half - 1.6 : lx + l.half + 1.6;
          target = Math.max(-4.8, Math.min(4.8, target));
        }
        capsizes += s.update(DT, target).filter((e) => e.type === 'capsize').length;
      }
      expect(s.distance, `seed=${seed} capsizes=${capsizes}`).toBeGreaterThan(3000);
    }
  });
});
