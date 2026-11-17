import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { fitFov, placeCamera, project } from '../src/game/camera';
import { BANK_X } from '../src/game/logic';
import { loadBest, recordRun, loadSound, saveSound, KV } from '../src/game/storage';

describe('カメラ（横持ち）', () => {
  const aspects = [1.33, 1.6, 1.78, 2.16, 2.4]; // PC・タブレット・スマホ横持ちの縦横比
  it('葉がどこにいても、川幅全体（両岸）が画面に入る', () => {
    for (const a of [1, ...aspects]) {
      const cam = new PerspectiveCamera();
      placeCamera(cam, a, 0, fitFov(a));
      for (const z of [1.6, 0, -10, -50, -100]) {
        for (const x of [-BANK_X, BANK_X]) {
          const p = project(cam, x, 0, z);
          expect(Math.abs(p.x), `aspect=${a} z=${z}`).toBeLessThanOrEqual(1);
        }
      }
      const leaf = project(cam, 0, 0, 0);
      expect(leaf.y).toBeGreaterThan(-0.95);
      expect(leaf.y).toBeLessThan(0);
    }
  });

  it('前方の川が画面の上の方まで見える（何もない霧の部分を少なく）', () => {
    for (const a of aspects) {
      const cam = new PerspectiveCamera();
      placeCamera(cam, a, 0, fitFov(a));
      // 100先の川が画面の上から2割以内に映る
      expect(project(cam, 0, 0, -100).y, `aspect=${a}`).toBeGreaterThan(0.6);
    }
  });
});

function memoryKV(): KV & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}
const brokenKV: KV = {
  getItem: () => { throw new Error('使えない'); },
  setItem: () => { throw new Error('使えない'); },
};

describe('ベスト記録の保存', () => {
  it('はじめは0。より良い記録だけが更新され、新記録が分かる', () => {
    const kv = memoryKV();
    expect(loadBest(kv)).toEqual({ distance: 0, beads: 0, rosaries: 0 });
    const r1 = recordRun({ distance: 500, beads: 30, rosaries: 0 }, kv);
    expect(r1.isNew).toEqual({ distance: true, beads: true, rosaries: false });
    const r2 = recordRun({ distance: 300, beads: 120, rosaries: 1 }, kv);
    expect(r2.isNew).toEqual({ distance: false, beads: true, rosaries: true });
    expect(loadBest(kv)).toEqual({ distance: 500, beads: 120, rosaries: 1 });
  });

  it('保存できない環境でもエラーにならない', () => {
    expect(loadBest(brokenKV)).toEqual({ distance: 0, beads: 0, rosaries: 0 });
    expect(() => recordRun({ distance: 1, beads: 1, rosaries: 0 }, brokenKV)).not.toThrow();
    expect(loadBest(null).distance).toBe(0);
    expect(loadSound(brokenKV)).toBe(false);
  });

  it('音の設定：初期はオフで、切り替えが保存される', () => {
    const kv = memoryKV();
    expect(loadSound(kv)).toBe(false);
    saveSound(true, kv);
    expect(loadSound(kv)).toBe(true);
  });
});
