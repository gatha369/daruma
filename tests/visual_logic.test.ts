import { describe, it, expect } from 'vitest';
import { paletteAt, MORNING } from '../src/game/scenery';
import { QualityController, SETTINGS, initialLevel, WINDOW, SETTLE } from '../src/game/quality';
import {
  NENJU_BEADS, NENJU_BEAD_R, OYADAMA_R, nenjuBead, oyadamaPos, glowLevel, rainbowHue,
} from '../src/game/rosary';
import { GLOW_WARN } from '../src/game/sim';

describe('景色（霧→夕暮れ→月夜のくり返しは外した）', () => {
  it('ずっと昼の景色で、和紙が集まるにつれて霧が晴れていく', () => {
    expect(paletteAt(0).fogFar).toBe(MORNING.fogFar);
    expect(paletteAt(1).fogFar).toBeGreaterThan(paletteAt(0).fogFar);
    expect(paletteAt(1).mist).toBeLessThan(paletteAt(0).mist);
    for (let k = 0; k <= 1; k += 0.05) {
      const p = paletteAt(k);
      expect(p.dark).toBe(0);
      expect(p.moon).toBe(0);
      expect(p.sky).toEqual(MORNING.sky);
    }
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

describe('念珠の形（玉8〜10個の輪に親玉と房）', () => {
  const all = () => [oyadamaPos(), ...Array.from({ length: NENJU_BEADS }, (_, i) => nenjuBead(i))];

  it('玉は8〜10個', () => {
    expect(NENJU_BEADS).toBeGreaterThanOrEqual(8);
    expect(NENJU_BEADS).toBeLessThanOrEqual(10);
  });

  it('親玉と玉が一つの輪に並び、となりどうしが重ならずにつながって見える', () => {
    const ps = all();
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      const b = ps[(i + 1) % ps.length];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      const ra = i === 0 ? OYADAMA_R : NENJU_BEAD_R;
      const rb = (i + 1) % ps.length === 0 ? OYADAMA_R : NENJU_BEAD_R;
      expect(d, `i=${i}`).toBeGreaterThan(ra + rb - 0.03); // 大きく食い込まない
      expect(d, `i=${i}`).toBeLessThan(ra + rb + 0.08); // 離れすぎない
    }
  });

  it('親玉はほかの玉より大きい', () => {
    expect(OYADAMA_R).toBeGreaterThan(NENJU_BEAD_R);
  });
});

describe('無敵中の七色の光', () => {
  it('色が順にめぐる', () => {
    const hs = [0, 0.2, 0.4, 0.6].map(rainbowHue);
    for (const h of hs) { expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); }
    expect(new Set(hs.map((h) => h.toFixed(2))).size).toBe(4);
  });

  it('残り2秒までは光りっぱなし、そこからは点滅、切れたら光らない', () => {
    expect(glowLevel(5, GLOW_WARN, 0.1)).toBe(1);
    expect(glowLevel(0, GLOW_WARN, 0.1)).toBe(0);
    const levels = new Set<number>();
    for (let t = 0; t < 1; t += 0.01) levels.add(glowLevel(1.5, GLOW_WARN, t));
    expect(levels.size).toBe(2); // 明るい・暗いを行き来する
  });
});
