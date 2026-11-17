// 操作の受け取り：PC（←→ / A D キー、マウス）とスマホ（ドラッグ）
import { RIVER_HALF_WIDTH, KEY_TARGET_SPEED, clamp } from './logic';

export class Input {
  targetX = 0;
  private left = false;
  private right = false;
  private dragging = false;
  /** 画面のどこかを押した／キーを押した（ボタンの上は除く） */
  onTap: (() => void) | null = null;
  onKey: ((key: string) => void) | null = null;

  /** toWorldX：画面の横位置（clientX, clientY）を川の左右位置に置き換える関数 */
  constructor(private toWorldX: (clientX: number, clientY: number) => number) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = true;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = true;
      if (!e.repeat) this.onKey?.(e.key);
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = false;
    });
    window.addEventListener('blur', () => { this.left = this.right = this.dragging = false; });

    // 案内の表示などが上に重なっていても受け取れるよう、画面全体で受ける
    window.addEventListener('pointerdown', (e) => {
      if ((e.target as Element | null)?.closest?.('button, a')) return; // ボタンはそれぞれの役目だけ
      this.dragging = true;
      this.fromPointer(e.clientX, e.clientY);
      this.onTap?.();
    });
    window.addEventListener('pointermove', (e) => {
      // マウスは動かすだけで追従、タッチは指を置いている間だけ
      if (e.pointerType === 'mouse' || this.dragging) this.fromPointer(e.clientX, e.clientY);
    });
    const end = () => { this.dragging = false; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  private fromPointer(clientX: number, clientY: number) {
    this.targetX = clamp(this.toWorldX(clientX, clientY), -RIVER_HALF_WIDTH, RIVER_HALF_WIDTH);
  }

  reset() { this.targetX = 0; this.left = this.right = false; }

  update(dt: number) {
    const dir = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    if (dir !== 0) {
      this.targetX = clamp(this.targetX + dir * KEY_TARGET_SPEED * dt, -RIVER_HALF_WIDTH, RIVER_HALF_WIDTH);
    }
  }
}
