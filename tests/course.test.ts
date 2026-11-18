import { describe, it, expect } from 'vitest';
import { RIVER_HALF_WIDTH, MAX_SPEED, makeRng, stepPlayer, leafHitsCircle, Player } from '../src/game/logic';
import {
  Course, Row, Rock, Whirl, makeRockRow, makeWhirlRow, ROW_SPACING, GAP_WIDTH, INTRO, WHIRL_PULL,
} from '../src/game/course';

/** 実際のプレイに近い形で、遠くまでコースを作る */
function buildCourse(seed: number, upTo: number) {
  const c = new Course(makeRng(seed));
  const all: Row[] = [];
  for (let d = 0; d < upTo; d += 50) {
    c.ensure(d + 150, { time: d / 12, distance: d });
    for (const r of c.rows) if (!all.includes(r)) all.push(r);
  }
  return { course: c, rows: all };
}

describe('岩の列', () => {
  it('どの列にも、岩のかからない隙間が必ずある', () => {
    const rng = makeRng(42);
    let gap = 0;
    for (let i = 0; i < 2000; i++) {
      const row = makeRockRow(i * ROW_SPACING, gap, (i % 10) / 9, rng);
      gap = row.gapX;
      expect(Math.abs(row.gapX) + GAP_WIDTH / 2).toBeLessThanOrEqual(RIVER_HALF_WIDTH + 1e-9);
      for (const r of row.obstacles as Rock[]) {
        expect(Math.abs(r.x - row.gapX)).toBeGreaterThanOrEqual(GAP_WIDTH / 2 + r.r);
      }
    }
  });

  it('序盤はまばらで、進むほど岩が増える', () => {
    const count = (level: number) => {
      const rng = makeRng(7);
      let n = 0;
      for (let i = 0; i < 500; i++) n += makeRockRow(0, 0, level, rng).obstacles.length;
      return n;
    };
    expect(count(1)).toBeGreaterThan(count(0) * 1.5);
  });

  it('最高速でも、隙間を追いかければ一度も岩に当たらずに進める', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const rng = makeRng(seed);
      const rows: Row[] = [];
      let gap = 0;
      for (let i = 1; i <= 300; i++) {
        const row = makeRockRow(i * ROW_SPACING + 30, gap, 1, rng);
        gap = row.gapX;
        rows.push(row);
      }
      let p: Player = { x: 0, vx: 0, targetX: 0 };
      let z = 0;
      const dt = 1 / 60;
      while (z < rows[rows.length - 1].z) {
        const next = rows.find((r) => r.z + 1.5 > z)!;
        p = stepPlayer({ ...p, targetX: next.gapX }, dt);
        z += MAX_SPEED * dt;
        const hit = rows.some((r) => Math.abs(r.z - z) < 4 &&
          (r.obstacles as Rock[]).some((o) => leafHitsCircle(p.x, z, o.x, o.z, o.r)));
        expect(hit, `seed=${seed} z=${z.toFixed(1)}`).toBe(false);
      }
    }
  });
});

describe('渦の列', () => {
  it('引き込まれる範囲の外に、通り抜けの道（gapX）を残す', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 2000; i++) {
      const prev = (rng() * 2 - 1) * (RIVER_HALF_WIDTH - 1.6);
      const row = makeWhirlRow(100, prev, rng);
      const w = row.obstacles[0] as Whirl;
      expect(Math.abs(row.gapX - w.x)).toBeGreaterThanOrEqual(WHIRL_PULL - 1e-9);
      expect(Math.abs(row.gapX)).toBeLessThanOrEqual(RIVER_HALF_WIDTH);
    }
  });
});

describe('出てくる順番と種類', () => {
  it('最初は岩だけで、流木・渦・大波・横向きの流れは決めた距離から出る', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { rows, course } = buildCourse(seed, 3500);
      for (const r of rows) {
        if (r.type === 'log') expect(r.z).toBeGreaterThanOrEqual(INTRO.log);
        if (r.type === 'whirl') expect(r.z).toBeGreaterThanOrEqual(INTRO.whirl);
        if (r.type === 'wave') expect(r.z).toBeGreaterThanOrEqual(INTRO.wave);
      }
      expect(course.currentAt(100)).toBe(0);
      const types = new Set(rows.map((r) => r.type));
      expect([...types].sort()).toEqual(['log', 'rocks', 'wave', 'whirl']);
    }
  });

  it('進むほど特別な障害物が増える', () => {
    const { rows } = buildCourse(11, 6000);
    const ratio = (lo: number, hi: number) => {
      const rs = rows.filter((r) => r.z >= lo && r.z < hi);
      return rs.filter((r) => r.type !== 'rocks').length / rs.length;
    };
    expect(ratio(3000, 6000)).toBeGreaterThan(ratio(0, 1000));
  });
});

describe('和紙と念珠の置き方', () => {
  it('岩や渦の中心には置かない', () => {
    for (const seed of [1, 2, 3]) {
      const { course, rows } = buildCourseAll(seed, 3000);
      for (const b of [...course.washi, ...course.nenjus]) {
        expect(Math.abs(b.x)).toBeLessThanOrEqual(RIVER_HALF_WIDTH);
        for (const r of rows) for (const o of r.obstacles) {
          if (o.kind === 'rock') expect(Math.hypot(o.x - b.x, o.z - b.z)).toBeGreaterThan(o.r + 0.3);
          if (o.kind === 'whirl') expect(Math.hypot(o.x - b.x, o.z - b.z)).toBeGreaterThan(o.core + 0.3);
        }
      }
    }
  });

  it('和紙は1枚ずつ：近すぎる所に何枚も並ばない（弧の並びはやめた）', () => {
    const { course } = buildCourseAll(5, 3000);
    const ws = [...course.washi].sort((a, b) => a.z - b.z);
    let tight = 0;
    for (let i = 1; i < ws.length; i++) if (Math.hypot(ws[i].x - ws[i - 1].x, ws[i].z - ws[i - 1].z) < 1.5) tight++;
    expect(tight / ws.length).toBeLessThan(0.08);
  });

  it('和紙は120枚集められるだけ出るが、これまでの珠よりずっと少ない', () => {
    const { course } = buildCourseAll(5, 2500);
    const n = course.washi.filter((b) => b.z < 2500).length;
    expect(n).toBeGreaterThan(150); // 取りこぼしを見込んでも120枚に届く
    expect(n).toBeLessThan(300); // これまでの珠は同じ距離で約1000個
  });

  it('念珠は和紙より明らかに珍しい', () => {
    const { course } = buildCourseAll(5, 2500);
    const n = course.nenjus.filter((b) => b.z < 2500).length;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
  });
});

describe('障害物の頻度（4.4）', () => {
  it('列の間隔を詰めて、これまで（間隔14）の約1.3倍の頻度にしてある', () => {
    expect(14 / ROW_SPACING).toBeGreaterThan(1.25);
    expect(14 / ROW_SPACING).toBeLessThan(1.35);
  });
});

/** 和紙・念珠も含めて、遠くまでコースを作る（後ろに流れたものも残す） */
function buildCourseAll(seed: number, upTo: number) {
  const c = new Course(makeRng(seed));
  const rows: Row[] = [];
  const washi = new Map<number, { id: number; x: number; z: number }>();
  const nenjus = new Map<number, { id: number; x: number; z: number }>();
  for (let d = 0; d < upTo; d += 50) {
    c.ensure(d + 150, { time: d / 12, distance: d });
    for (const r of c.rows) if (!rows.includes(r)) rows.push(r);
    for (const w of c.washi) washi.set(w.id, w);
    for (const n of c.nenjus) nenjus.set(n.id, n);
  }
  return { course: { washi: [...washi.values()], nenjus: [...nenjus.values()] }, rows };
}
