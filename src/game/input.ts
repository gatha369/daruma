// 操作の受け取り：PC（←→ / A D キー、マウス）とスマホ（ドラッグ）
import { RIVER_HALF_WIDTH, KEY_TARGET_SPEED, clamp } from './logic';

export class Input {
  targetX = 0;
  private left = false;
  private right = false;
  private dragging = false;
  onAction: (() => void) | null = null; // 開始・やり直しの合図

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = true;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = true;
      this.onAction?.();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = false;
    });
    window.addEventListener('blur', () => { this.left = this.right = this.dragging = false; });

    // 開始案内などの表示が上に重なっていても受け取れるよう、画面全体で受ける
    window.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.fromPointer(e.clientX);
      this.onAction?.();
    });
    window.addEventListener('pointermove', (e) => {
      // マウスは動かすだけで追従、タッチは指を置いている間だけ
      if (e.pointerType === 'mouse' || this.dragging) this.fromPointer(e.clientX);
    });
    const end = () => { this.dragging = false; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /** 画面の横位置を川の左右位置に置き換える（画面端より少し内側で川端になる） */
  private fromPointer(clientX: number) {
    const w = this.el.clientWidth || window.innerWidth;
    const t = (clientX / w) * 2 - 1; // -1〜1
    this.targetX = clamp(t * 1.15, -1, 1) * RIVER_HALF_WIDTH;
  }

  reset() { this.targetX = 0; }

  update(dt: number) {
    const dir = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    if (dir !== 0) {
      this.targetX = clamp(this.targetX + dir * KEY_TARGET_SPEED * dt, -RIVER_HALF_WIDTH, RIVER_HALF_WIDTH);
    }
  }
}
