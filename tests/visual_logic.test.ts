import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_LENGTH, TRANSITION, stageAt, paletteAt } from '../src/game/scenery';
import { QualityController, SETTINGS, initialLevel, WINDOW, SETTLE } from '../src/game/quality';
import { feetBead, wornBead, liftBead, WORN } from '../src/game/rosary';
import { ROSARY_SIZE } from '../src/game/sim';

describe('距離に応じた景色の変化（霧 → 夕暮れ → 月夜 をくり返す）', () => {
  const name = (d: number) => {
    const s = stageAt(d);
    return STAGES[s.t < 0.5 ? s.from : s.to].name;
  };
  it('10里ごとに景色が変わり、3つ目のあとは最初に戻る', () => {
    expect(name(0)).toBe('霧');
    expect(name(STAGE_LENGTH * 0.5)).toBe('霧');
    expect(name(STAGE_LENGTH * 1.5)).toBe('夕暮れ');
    expect(name(STAGE_LENGTH * 2.5)).toBe('月夜');
    expect(name(STAGE_LENGTH * 3.5)).toBe('霧');
  });

  it('切り替わりは急ではなく、2里かけてなめらかに移る', () => {
    const start = STAGE_LENGTH - TRANSITION;
    expect(stageAt(start - 1).t).toBe(0);
    const mid = stageAt(start + TRANSITION / 2).t;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    // 少し進んだだけで色が大きく飛ばない
    for (let d = 0; d < STAGE_LENGTH * 3; d += 5) {
      const a = paletteAt(d).sky;
      const b = paletteAt(d + 5).sky;
      const diff = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      expect(diff, `d=${d}`).toBeLessThan(0.05);
    }
  });

  it('最初の霧は、進むにつれて晴れていく', () => {
    expect(paletteAt(700).fogFar).toBeGreaterThan(paletteAt(0).fogFar);
    expect(paletteAt(700).mist).toBeLessThan(paletteAt(0).mist);
  });

  it('夜は暗く、夕日と月はそれぞれの景色でだけ出る', () => {
    const night = paletteAt(STAGE_LENGTH * 2.5);
    expect(night.dark).toBe(1);
    expect(night.moon).toBe(1);
    expect(night.sun).toBe(0);
    expect(paletteAt(STAGE_LENGTH * 1.5).sun).toBe(1);
    expect(paletteAt(100).dark).toBe(0);
  });
});

describe('重い端末向けの自動調整', () => {
  const feed = (q: QualityController, fps: number, seconds: number) => {
    let changed: number | null = null;
    for (let t = 0; t < seconds; t += 1 / fps) {
      const r = q.frame(1 / fps);
      if (r !== null) changed = r;
    }
    return changed;
  };

  it('滑らかに動いていれば、そのまま', () => {
    const q = new QualityController(2);
    expect(feed(q, 60, 10)).toBeNull();
    expect(q.level).toBe(2);
  });

  it('カクつき続けると、1段ずつ軽くなり、いちばん軽い段で止まる', () => {
    const q = new QualityController(2);
    feed(q, 25, SETTLE + WINDOW + 0.2);
    expect(q.level).toBe(1);
    feed(q, 25, 20);
    expect(q.level).toBe(0);
    feed(q, 25, 20);
    expect(q.level).toBe(0);
  });

  it('一度軽くしたら、速くなっても戻さない（チラつかないように）', () => {
    const q = new QualityController(2);
    feed(q, 20, 5);
    const lv = q.level;
    expect(lv).toBeLessThan(2);
    for (let i = 0; i < 600; i++) {
      q.frame(1 / 60);
      expect(q.level).toBeLessThanOrEqual(lv); // 上がることはない
    }
  });

  it('別のタブにいた等の、極端に長い1コマは数えない', () => {
    const q = new QualityController(2);
    for (let i = 0; i < 20; i++) q.frame(3);
    expect(q.level).toBe(2);
  });

  it('軽い段ほど、画面のきめ細かさと水面の細かさが下がる', () => {
    expect(SETTINGS[0].pixelRatio).toBeLessThan(SETTINGS[2].pixelRatio);
    expect(SETTINGS[0].waterDetail).toBeLessThan(SETTINGS[2].waterDetail);
    expect(SETTINGS[0].mist).toBe(false);
    expect(initialLevel(true)).toBeLessThan(initialLevel(false));
  });
});

describe('念珠の珠の並び', () => {
  it('足元の108個は、重ならずに一周する', () => {
    const ps = Array.from({ length: ROSARY_SIZE }, (_, i) => feetBead(i));
    for (let i = 0; i < ROSARY_SIZE; i++) {
      const a = ps[i];
      const b = ps[(i + 1) % ROSARY_SIZE];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      expect(d).toBeGreaterThan(0.02);
      expect(d).toBeLessThan(0.08); // 隣どうしがつながって見える間隔
    }
  });

  it('手に掛けた念珠は達磨の体（半径0.42）の外側にある', () => {
    for (let i = 0; i < ROSARY_SIZE; i++) {
      const w = wornBead(i);
      expect(Math.hypot(w.x, w.z)).toBeGreaterThan(0.42 * Math.cos(WORN.tilt) - 0.01);
    }
  });

  it('完成の演出は足元から始まり、手に掛けた位置で終わる', () => {
    for (const i of [0, 27, 54, 107]) {
      expect(liftBead(i, 0)).toEqual(feetBead(i));
      const end = liftBead(i, 1);
      const w = wornBead(i);
      expect(end.x).toBeCloseTo(w.x, 6);
      expect(end.y).toBeCloseTo(w.y, 6);
      expect(end.z).toBeCloseTo(w.z, 6);
    }
  });
});
