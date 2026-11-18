import { describe, it, expect } from 'vitest';
import {
  sceneWeights, sceneAt, kakeshoApproach, pickBankThing, paletteAt, BankThing, SCENE_EDGES,
} from '../src/game/scenery';
import {
  clearState, STROKE_ORDER, STROKE_TIME, DRAW_START, DRAW_END, LIFT_START, LIFT_TIME, TITLE_AT, PANEL_AT, CLEAR_TOTAL,
} from '../src/game/clearTimeline';
import { NENJU_RING, NENJU_BEAD_R, OYADAMA_R } from '../src/game/rosary';
import { WASHI_SIZE, WASHI_RADIUS, NENJU_RADIUS } from '../src/game/sim';
import { makeRng } from '../src/game/logic';

describe('道のりに合わせた景色の変化（名古屋城 → 町並み → 西掛所）', () => {
  it('和紙の枚数に応じて、名古屋城 → 堀川の町並み → 西掛所 と移る', () => {
    expect(sceneAt(0)).toBe('castle');
    expect(sceneAt(0.2)).toBe('castle');
    expect(sceneAt(0.5)).toBe('town');
    expect(sceneAt(0.8)).toBe('kakesho');
    expect(sceneAt(1)).toBe('kakesho');
  });

  it('場面の濃さは合計がいつも1で、少しずつなめらかに移る（急に切り替わらない）', () => {
    let prev = sceneWeights(0);
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const w = sceneWeights(p);
      expect(w.castle + w.town + w.kakesho).toBeCloseTo(1, 9);
      for (const k of ['castle', 'town', 'kakesho'] as const) {
        expect(w[k]).toBeGreaterThanOrEqual(0);
        expect(Math.abs(w[k] - prev[k]), `p=${p.toFixed(2)}`).toBeLessThan(0.1);
      }
      prev = w;
    }
  });

  it('西掛所は町並みの途中から見えはじめ、120枚目に向かって近づく', () => {
    expect(kakeshoApproach(0)).toBe(0);
    expect(kakeshoApproach(SCENE_EDGES[0])).toBe(0);
    let prev = 0;
    for (let p = 0.5; p <= 1; p += 0.05) {
      const a = kakeshoApproach(p);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
    expect(kakeshoApproach(1)).toBe(1);
  });

  it('川岸に並ぶもの：お城のあたりは松、町並みは蔵・町家・舟、西掛所の近くは築地塀', () => {
    const count = (p: number) => {
      const rng = makeRng(9);
      const c: Partial<Record<BankThing, number>> = {};
      for (let i = 0; i < 2000; i++) { const k = pickBankThing(p, rng()); c[k] = (c[k] ?? 0) + 1; }
      return c;
    };
    const castle = count(0.1);
    const town = count(0.5);
    const temple = count(0.95);
    expect(castle.matsu!).toBeGreaterThan(800);
    expect(castle.tsuiji ?? 0).toBe(0);
    expect((town.kura ?? 0) + (town.machiya ?? 0) + (town.fune ?? 0)).toBeGreaterThan(1500);
    expect(temple.tsuiji!).toBeGreaterThan(900);
    expect(town.tsuiji ?? 0).toBe(0);
  });

  it('景色はずっと昼で、霧が晴れていく（夜にはならない）', () => {
    for (let p = 0; p <= 1; p += 0.1) expect(paletteAt(p).dark).toBe(0);
  });
});

describe('和紙と念珠の見えやすさ（ステップ5の確認結果）', () => {
  it('和紙はステップ5（一辺0.7）より大きく、拾える範囲も見た目に合わせて広い', () => {
    expect(WASHI_SIZE).toBeGreaterThan(0.7 * 1.25);
    expect(WASHI_RADIUS).toBeGreaterThan(0.35);
    expect(WASHI_RADIUS).toBeLessThanOrEqual(WASHI_SIZE / 2);
  });

  it('念珠の輪はステップ5（半径0.4・玉0.1）より大きい', () => {
    expect(NENJU_RING).toBeGreaterThan(0.4);
    expect(NENJU_BEAD_R).toBeGreaterThan(0.1);
    expect(OYADAMA_R).toBeGreaterThan(NENJU_BEAD_R);
    expect(NENJU_RADIUS).toBeGreaterThan(0.45);
  });
});

describe('クリア演出の流れ（第5章）', () => {
  it('和紙が敷かれてから描きはじめる', () => {
    const s = clearState(0.1);
    expect(s.sheet).toBeLessThan(1);
    expect(s.strokes.every((k) => k === 0)).toBe(true);
    expect(clearState(DRAW_START).sheet).toBe(1);
  });

  it('記録どおり 眉間 → 鼻 → 目 → 顔の輪郭 → 衣 の順に描く（前の部分を描き終えてから次へ）', () => {
    expect([...STROKE_ORDER]).toEqual(['眉間', '鼻', '目', '顔の輪郭', '衣']);
    const order: number[] = [];
    for (let t = 0; t < DRAW_END + 0.5; t += 0.02) {
      const s = clearState(t);
      if (s.drawing >= 0 && order[order.length - 1] !== s.drawing) order.push(s.drawing);
      // 描いている部分より前は描き終わっていて、後ろはまだ描いていない
      if (s.drawing >= 0) {
        s.strokes.forEach((k, i) => {
          if (i < s.drawing) expect(k).toBe(1);
          if (i > s.drawing) expect(k).toBe(0);
        });
        expect(s.painter).toBe(true); // 描いている間は北斎がいる
      }
    }
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(clearState(DRAW_END).strokes.every((k) => k === 1)).toBe(true);
  });

  it('描き上がってから櫓に引き上げ、はためいて、「大だるま絵 完成」→ クリア画面', () => {
    expect(clearState(DRAW_END).lift).toBe(0);
    expect(LIFT_START).toBeGreaterThan(DRAW_END);
    expect(clearState(LIFT_START + LIFT_TIME / 2).lift).toBeGreaterThan(0.3);
    expect(clearState(LIFT_START + LIFT_TIME).lift).toBe(1);
    expect(clearState(LIFT_START + LIFT_TIME - 0.01).flutter).toBe(false);
    expect(clearState(LIFT_START + LIFT_TIME).flutter).toBe(true);
    expect(clearState(LIFT_START + LIFT_TIME).cheer).toBe(true);
    expect(clearState(LIFT_START).painter).toBe(false); // 引き上げるころには北斎は下がっている
    expect(clearState(TITLE_AT - 0.01).title).toBe(false);
    expect(clearState(TITLE_AT).title).toBe(true);
    expect(PANEL_AT).toBeGreaterThan(TITLE_AT);
    expect(clearState(PANEL_AT).panel).toBe(true);
  });

  it('全体で十数秒以内（数秒〜十数秒の早回し）', () => {
    expect(STROKE_TIME.reduce((a, b) => a + b, 0)).toBeGreaterThan(3);
    expect(CLEAR_TOTAL).toBeLessThan(16);
  });
});
