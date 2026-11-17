import { describe, it, expect } from 'vitest';
import {
  RIVER_HALF_WIDTH, MAX_SPEED, START_SPEED, CAP_DISTANCE, LEAF_HIT_RADIUS, LEAF_HIT_OFFSET,
  speedAt, stepPlayer, leafHitsCircle, leafHitsLog, formatRi, Player,
} from '../src/game/logic';

describe('前進のスピード', () => {
  it('最初は初速で、進むほど速くなり、上限の距離から先は増えない', () => {
    expect(speedAt(0)).toBe(START_SPEED);
    expect(speedAt(1000)).toBeGreaterThan(speedAt(300));
    expect(speedAt(CAP_DISTANCE)).toBe(MAX_SPEED);
    expect(speedAt(CAP_DISTANCE * 10)).toBe(MAX_SPEED);
  });
});

describe('左右の動き', () => {
  it('ピタッとは動かず、少し遅れて目標に寄っていく', () => {
    let p: Player = { x: 0, vx: 0, targetX: 3 };
    p = stepPlayer(p, 1 / 60);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(0.5);
    for (let i = 0; i < 120; i++) p = stepPlayer(p, 1 / 60);
    expect(p.x).toBeCloseTo(3, 1);
  });

  it('川の外には出ない', () => {
    let p: Player = { x: 0, vx: 0, targetX: 100 };
    for (let i = 0; i < 300; i++) {
      p = stepPlayer(p, 1 / 60, { push: 50 });
      expect(Math.abs(p.x)).toBeLessThanOrEqual(RIVER_HALF_WIDTH);
    }
  });

  it('外からの力（流れ）で押される', () => {
    let p: Player = { x: 0, vx: 0, targetX: 0 };
    for (let i = 0; i < 120; i++) p = stepPlayer(p, 1 / 60, { push: 16 });
    expect(p.x).toBeGreaterThan(0.5);
  });

  it('操作が効きにくいときは、目標への寄り方が遅い', () => {
    let a: Player = { x: 0, vx: 0, targetX: 4 };
    let b: Player = { ...a };
    for (let i = 0; i < 20; i++) {
      a = stepPlayer(a, 1 / 60);
      b = stepPlayer(b, 1 / 60, { control: 0.3 });
    }
    expect(b.x).toBeLessThan(a.x * 0.6);
  });
});

describe('当たり判定', () => {
  it('岩：真正面と葉の先端は当たり、横に離れれば当たらない', () => {
    expect(leafHitsCircle(0, 0, 0, 0, 0.5)).toBe(true);
    expect(leafHitsCircle(0, 0, 0, LEAF_HIT_OFFSET + 0.7, 0.5)).toBe(true);
    expect(leafHitsCircle(0, 0, 0.5 + LEAF_HIT_RADIUS + 0.05, 0, 0.5)).toBe(false);
  });
  it('流木：棒の端の近くでも当たり、端より外なら当たらない', () => {
    expect(leafHitsLog(1.4, 0, 0, 0, 1.5, 0.28)).toBe(true);
    expect(leafHitsLog(2.3, 0, 0, 0, 1.5, 0.28)).toBe(false);
    expect(leafHitsLog(0, 2, 0, 0, 1.5, 0.28)).toBe(false);
  });
});

describe('距離の表示', () => {
  it('里の単位で小数1桁', () => {
    expect(formatRi(0)).toBe('0.0');
    expect(formatRi(250)).toBe('2.5');
    expect(formatRi(-5)).toBe('0.0');
  });
});
