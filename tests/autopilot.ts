// テスト用の自動操縦：少し先の通り道をたどり、近くの和紙・念珠に安全そうなら寄る
import { Sim, CURRENT_FORCE } from '../src/game/sim';
import { STIFFNESS } from '../src/game/logic';
import { Log, logX } from '../src/game/course';

export function autopilotTarget(s: Sim, greedy = true): number {
  const next = s.course.rows.find((r) => r.z + 1.5 > s.distance);
  let target = next ? next.gapX : 0;
  if (greedy) {
    // すぐ先（次の列より手前）にある和紙・念珠で、いまの道から近いものに寄る
    const limit = next ? next.z - 1 : s.distance + 12;
    const items = [...s.course.nenjus, ...s.course.washi]
      .filter((w) => !w.taken && w.z > s.distance + 1 && w.z < limit && Math.abs(w.x - s.player.x) < 3);
    if (items.length) target = items[0].x;
  }
  if (next?.type === 'log') {
    const l = next.obstacles[0] as Log;
    const eta = (next.z - s.distance) / s.speed;
    const lx = logX(l, s.time + eta);
    if (Math.abs(lx - target) < l.half + 1.2) target = lx > 0 ? lx - l.half - 1.6 : lx + l.half + 1.6;
  }
  // 横向きの流れ・渦に押される分を見越して、反対側へ舵を取る
  const push = s.course.currentAt(s.distance) * CURRENT_FORCE + s.whirlPush();
  target -= push / (STIFFNESS * s.control);
  return Math.max(-5, Math.min(5, target));
}
