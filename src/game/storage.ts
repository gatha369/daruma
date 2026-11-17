// ベスト記録と設定の保存（ブラウザ内）。保存できない環境でもゲームは動くようにする

export interface Best { distance: number; beads: number; rosaries: number }
export interface RunResult { distance: number; beads: number; rosaries: number }
export interface NewRecords { distance: boolean; beads: boolean; rosaries: boolean }

const BEST_KEY = 'ichii-tokou:best';
const SOUND_KEY = 'ichii-tokou:sound';

/** localStorage と同じ形の入れ物（テストでは差し替える） */
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }

function defaultKV(): KV | null {
  try { return window.localStorage; } catch { return null; }
}

export function loadBest(kv: KV | null = defaultKV()): Best {
  const empty = { distance: 0, beads: 0, rosaries: 0 };
  try {
    const raw = kv?.getItem(BEST_KEY);
    if (!raw) return empty;
    const b = JSON.parse(raw);
    return {
      distance: Number(b.distance) || 0,
      beads: Number(b.beads) || 0,
      rosaries: Number(b.rosaries) || 0,
    };
  } catch {
    return empty;
  }
}

/** 今回の結果でベスト記録を更新し、どれが新記録だったかを返す */
export function recordRun(run: RunResult, kv: KV | null = defaultKV()): { best: Best; isNew: NewRecords } {
  const old = loadBest(kv);
  const isNew = {
    distance: run.distance > old.distance,
    beads: run.beads > old.beads,
    rosaries: run.rosaries > old.rosaries,
  };
  const best = {
    distance: Math.max(old.distance, run.distance),
    beads: Math.max(old.beads, run.beads),
    rosaries: Math.max(old.rosaries, run.rosaries),
  };
  try { kv?.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* 保存できなくても続ける */ }
  return { best, isNew };
}

export function loadSound(kv: KV | null = defaultKV()): boolean {
  try { return kv?.getItem(SOUND_KEY) === 'on'; } catch { return false; } // 初期状態はオフ
}

export function saveSound(on: boolean, kv: KV | null = defaultKV()) {
  try { kv?.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* 無視 */ }
}
