// ベスト記録と設定の保存（ブラウザ内）。保存できない環境でもゲームは動くようにする

export interface Best {
  washi: number; // 集めた和紙の最多枚数
  clearTime: number; // クリアまでの最短時間（秒）。0 はまだクリアしていない
  lives: number; // クリアしたときの残り回数の最多（クリアしていなければ 0）
}
export type RunResult =
  | { cleared: true; washi: number; clearTime: number; lives: number }
  | { cleared: false; washi: number };
export interface NewRecords { washi: boolean; clearTime: boolean; lives: boolean }

const BEST_KEY = 'hokusai-daruma:best';
const SOUND_KEY = 'hokusai-daruma:sound';

/** localStorage と同じ形の入れ物（テストでは差し替える） */
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }

function defaultKV(): KV | null {
  try { return window.localStorage; } catch { return null; }
}

const EMPTY: Best = { washi: 0, clearTime: 0, lives: 0 };

export function loadBest(kv: KV | null = defaultKV()): Best {
  try {
    const raw = kv?.getItem(BEST_KEY);
    if (!raw) return { ...EMPTY };
    const b = JSON.parse(raw);
    return {
      washi: Number(b.washi) || 0,
      clearTime: Number(b.clearTime) || 0,
      lives: Number(b.lives) || 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** 今回の結果でベスト記録を更新し、どれが新記録だったかを返す */
export function recordRun(run: RunResult, kv: KV | null = defaultKV()): { best: Best; isNew: NewRecords } {
  const old = loadBest(kv);
  const isNew = {
    washi: run.washi > old.washi,
    clearTime: run.cleared && (old.clearTime === 0 || run.clearTime < old.clearTime),
    lives: run.cleared && (old.clearTime === 0 || run.lives > old.lives),
  };
  const best: Best = {
    washi: Math.max(old.washi, run.washi),
    clearTime: isNew.clearTime && run.cleared ? run.clearTime : old.clearTime,
    lives: isNew.lives && run.cleared ? run.lives : old.lives,
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
