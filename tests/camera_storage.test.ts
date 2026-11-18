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
      for (const z of [3, 1.6, 0, -10, -50, -100]) {
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

  it('前方の川がよく見え、地平線の上に遠景の山の入る空が少しだけある', () => {
    for (const a of aspects) {
      const cam = new PerspectiveCamera();
      placeCamera(cam, a, 0, fitFov(a));
      expect(project(cam, 0, 0, -60).y, `aspect=${a}`).toBeGreaterThan(0.4); // 60先の川が画面の上半分に映る
      const horizon = project(cam, 0, 0, -5000).y;
      expect(horizon, `aspect=${a}`).toBeGreaterThan(0.6); // 空（霧と山）は上から2割まで
      expect(horizon, `aspect=${a}`).toBeLessThan(0.85); // 山が見える分の空は残す
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
  it('はじめは0。途中で終わったときは枚数だけが記録される', () => {
    const kv = memoryKV();
    expect(loadBest(kv)).toEqual({ washi: 0, clearTime: 0, lives: 0 });
    const r1 = recordRun({ cleared: false, washi: 40 }, kv);
    expect(r1.isNew).toEqual({ washi: true, clearTime: false, lives: false });
    const r2 = recordRun({ cleared: false, washi: 30 }, kv);
    expect(r2.isNew.washi).toBe(false);
    expect(loadBest(kv)).toEqual({ washi: 40, clearTime: 0, lives: 0 });
  });

  it('クリアしたとき：時間は短いほど、残り回数は多いほど新記録', () => {
    const kv = memoryKV();
    const r1 = recordRun({ cleared: true, washi: 120, clearTime: 200, lives: 1 }, kv);
    expect(r1.isNew).toEqual({ washi: true, clearTime: true, lives: true });
    const r2 = recordRun({ cleared: true, washi: 120, clearTime: 230, lives: 3 }, kv);
    expect(r2.isNew).toEqual({ washi: false, clearTime: false, lives: true });
    const r3 = recordRun({ cleared: true, washi: 120, clearTime: 180, lives: 0 }, kv);
    expect(r3.isNew).toEqual({ washi: false, clearTime: true, lives: false });
    expect(loadBest(kv)).toEqual({ washi: 120, clearTime: 180, lives: 3 });
    recordRun({ cleared: false, washi: 50 }, kv); // 途中で終わってもクリアの記録は消えない
    expect(loadBest(kv)).toEqual({ washi: 120, clearTime: 180, lives: 3 });
  });

  it('保存できない環境でもエラーにならない', () => {
    expect(loadBest(brokenKV)).toEqual({ washi: 0, clearTime: 0, lives: 0 });
    expect(() => recordRun({ cleared: false, washi: 1 }, brokenKV)).not.toThrow();
    expect(loadBest(null).washi).toBe(0);
    expect(loadSound(brokenKV)).toBe(false);
  });

  it('音の設定：初期はオフで、切り替えが保存される', () => {
    const kv = memoryKV();
    expect(loadSound(kv)).toBe(false);
    saveSound(true, kv);
    expect(loadSound(kv)).toBe(true);
  });
});
