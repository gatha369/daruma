import { describe, it, expect } from 'vitest';
import {
  RIVER_HALF_WIDTH, ROW_SPACING, GAP_WIDTH, MAX_SPEED, START_SPEED, LEAF_HIT_RADIUS, LEAF_HIT_OFFSET,
  speedAt, stepPlayer, hitsRock, hitsAny, formatRi, makeRow, makeRng, Player, Row,
} from '../src/game/logic';

describe('前進のスピード', () => {
  it('最初は初速で、時間とともに速くなり、上限で止まる', () => {
    expect(speedAt(0)).toBe(START_SPEED);
    expect(speedAt(30)).toBeGreaterThan(speedAt(10));
    expect(speedAt(10000)).toBe(MAX_SPEED);
  });
});

describe('左右の動き', () => {
  it('ピタッとは動かず、少し遅れて目標に寄っていく', () => {
    let p: Player = { x: 0, vx: 0, targetX: 3 };
    p = stepPlayer(p, 1 / 60);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(0.5); // 1コマで飛びつかない
    for (let i = 0; i < 120; i++) p = stepPlayer(p, 1 / 60);
    expect(p.x).toBeCloseTo(3, 1); // 2秒後にはほぼ目標の位置
  });

  it('川の外には出ない', () => {
    let p: Player = { x: 0, vx: 0, targetX: 100 };
    for (let i = 0; i < 300; i++) {
      p = stepPlayer(p, 1 / 60);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(RIVER_HALF_WIDTH);
    }
  });
});

describe('岩との当たり判定', () => {
  it('真正面の岩には当たる', () => {
    expect(hitsRock(0, 0, { x: 0, z: 0, r: 0.5 })).toBe(true);
  });
  it('葉の先端に近い岩にも当たる', () => {
    expect(hitsRock(0, 0, { x: 0, z: LEAF_HIT_OFFSET + 0.7, r: 0.5 })).toBe(true);
  });
  it('横に離れた岩には当たらない', () => {
    expect(hitsRock(0, 0, { x: 0.5 + LEAF_HIT_RADIUS + 0.05, z: 0, r: 0.5 })).toBe(false);
    expect(hitsAny(0, 0, [{ x: 3, z: 0, r: 0.5 }, { x: -3, z: 0, r: 0.5 }])).toBe(false);
  });
});

describe('距離の表示', () => {
  it('里の単位で小数1桁', () => {
    expect(formatRi(0)).toBe('0.0');
    expect(formatRi(250)).toBe('2.5');
    expect(formatRi(-5)).toBe('0.0');
  });
});

describe('岩の並び', () => {
  it('どの列にも、岩のかからない隙間が必ずある', () => {
    const rng = makeRng(42);
    let gap = 0;
    for (let i = 0; i < 2000; i++) {
      const row = makeRow(i * ROW_SPACING, gap, i * ROW_SPACING, rng);
      gap = row.gapX;
      expect(Math.abs(row.gapX) + GAP_WIDTH / 2).toBeLessThanOrEqual(RIVER_HALF_WIDTH + 1e-9);
      for (const r of row.rocks) {
        expect(Math.abs(r.x - row.gapX)).toBeGreaterThanOrEqual(GAP_WIDTH / 2 + r.r);
      }
    }
  });

  it('序盤はまばらで、進むほど岩が増える', () => {
    const count = (dist: number) => {
      const rng = makeRng(7);
      let n = 0;
      for (let i = 0; i < 500; i++) n += makeRow(0, 0, dist, rng).rocks.length;
      return n;
    };
    expect(count(3000)).toBeGreaterThan(count(0) * 1.5);
  });

  it('最高速でも、隙間を追いかければ一度も岩に当たらずに進める', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const rng = makeRng(seed);
      const rows: Row[] = [];
      let gap = 0;
      for (let i = 1; i <= 300; i++) {
        const row = makeRow(i * ROW_SPACING + 30, gap, 3000, rng); // 最も密な状態
        gap = row.gapX;
        rows.push(row);
      }
      let p: Player = { x: 0, vx: 0, targetX: 0 };
      let z = 0;
      const dt = 1 / 60;
      while (z < rows[rows.length - 1].z) {
        // 次に来る列の隙間を目標にする（指でなぞるイメージ）
        const next = rows.find((r) => r.z + 1.5 > z)!;
        p = stepPlayer({ ...p, targetX: next.gapX }, dt);
        z += MAX_SPEED * dt;
        const near = rows.filter((r) => Math.abs(r.z - z) < 4).flatMap((r) => r.rocks);
        expect(hitsAny(p.x, z, near), `seed=${seed} z=${z.toFixed(1)}`).toBe(false);
      }
    }
  });
});
