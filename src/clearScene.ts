// クリア演出（第5章）の表示。時間の流れは game/clearTimeline.ts、ここでは画面に反映するだけ
import { clearState, CLEAR_TOTAL, STROKE_ORDER } from './game/clearTimeline';

const TILT = 56; // 地面に敷いた和紙を見下ろす角度（度）

interface Stroke { el: SVGGeometryElement; len: number }
interface Part { strokes: Stroke[]; total: number; pupils: SVGElement[] }

export class ClearScene {
  private t = 0;
  private running = false;
  private raf = 0;
  private last = 0;
  private parts: Part[];
  private wash: SVGPathElement;
  private sheet: HTMLElement;
  private wrap: HTMLElement;
  private painter: SVGSVGElement;
  private yagura: SVGSVGElement;
  private crowd: SVGSVGElement;
  private titleEl: HTMLElement;
  private panelShown = false;

  constructor(private root: HTMLElement, private onPanel: () => void) {
    const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
    this.wash = $('#daruma-art .wash');
    this.sheet = $('#sheet');
    this.wrap = $('#sheet-wrap');
    this.painter = $('#hokusai');
    this.yagura = $('#yagura');
    this.crowd = $('#crowd');
    this.titleEl = $('#clear-title');
    // 描く順番どおりに、各部分の線を集める
    this.parts = STROKE_ORDER.map((name) => {
      const g = $(`[data-part="${name}"]`);
      const strokes = Array.from(g.querySelectorAll<SVGGeometryElement>('path, circle:not(.pupil)')).map((el) => ({ el, len: 0 }));
      const pupils = Array.from(g.querySelectorAll<SVGElement>('.pupil'));
      return { strokes, total: 0, pupils };
    });
    this.makeCrowd();
  }

  /** 見物人（頭と肩の影を横に並べる） */
  private makeCrowd() {
    const ns = 'http://www.w3.org/2000/svg';
    let x = 4;
    let i = 0;
    while (x < 400) {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'person');
      g.style.animationDelay = `${(i * 0.13) % 0.6}s`;
      const h = 6 + ((i * 37) % 5);
      const head = document.createElementNS(ns, 'circle');
      head.setAttribute('cx', String(x));
      head.setAttribute('cy', String(40 - h - 8));
      head.setAttribute('r', '4.2');
      const body = document.createElementNS(ns, 'path');
      body.setAttribute('d', `M${x - 7} 40 Q${x - 6} ${40 - h - 2} ${x} ${40 - h - 3} Q${x + 6} ${40 - h - 2} ${x + 7} 40 Z`);
      g.append(head, body);
      this.crowd.appendChild(g);
      x += 9 + ((i * 53) % 6);
      i++;
    }
  }

  get done() { return this.panelShown; }

  start() {
    // 線の長さを測って、描き始めの状態にする
    for (const p of this.parts) {
      p.total = 0;
      for (const s of p.strokes) {
        s.len = s.el.getTotalLength();
        p.total += s.len;
        s.el.style.strokeDasharray = `${s.len} ${s.len}`;
      }
    }
    this.t = 0;
    this.panelShown = false;
    this.running = true;
    this.apply();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    const tick = (now: number) => {
      if (!this.running) return;
      this.t += Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.apply();
      if (this.t < CLEAR_TOTAL + 0.1) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** 演出を飛ばして、描き上がった状態にする */
  skip() {
    this.t = CLEAR_TOTAL;
    this.apply();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private apply() {
    const st = clearState(this.t);
    // 和紙が敷かれる（奥から手前へ広がる）
    this.sheet.style.clipPath = `inset(0 0 ${(1 - st.sheet) * 100}% 0)`;
    // 線を描く。各部分の中では、線を順番に一本ずつ
    let brush: DOMPoint | null = null;
    this.parts.forEach((p, i) => {
      let rest = st.strokes[i] * p.total;
      for (const s of p.strokes) {
        const k = Math.max(0, Math.min(s.len, rest));
        s.el.style.strokeDashoffset = String(s.len - k);
        s.el.style.opacity = k > 0 ? '1' : '0';
        if (i === st.drawing && k > 0 && k < s.len) brush = s.el.getPointAtLength(k);
        rest -= s.len;
      }
      for (const e of p.pupils) e.style.opacity = st.strokes[i] >= 1 ? '1' : '0';
    });
    // 衣の色は、衣を描き終えるころに墨がにじむように
    const robe = st.strokes[st.strokes.length - 1];
    this.wash.style.opacity = String(Math.max(0, (robe - 0.6) / 0.4) * 0.55);

    // 北斎：筆の穂先が描いている線の先に来る。描いていない間は、その場で待つ
    this.painter.style.opacity = st.painter ? '1' : '0';
    if (brush) {
      const b = brush as DOMPoint;
      this.painter.style.left = `${(b.x / 220) * 100}%`;
      this.painter.style.top = `${(b.y / 360) * 100}%`;
    } else if (this.t < 1.2) {
      this.painter.style.left = '47%';
      this.painter.style.top = '33%';
    }

    // 櫓へ引き上げる：寝かせた和紙が起き上がり、上へ
    const e = st.lift;
    this.wrap.style.transform = `translateY(${-6 * e}%) rotateX(${TILT * (1 - e)}deg) scale(${1 - 0.12 * e})`;
    this.yagura.style.opacity = String(Math.max(0, (e - 0.5) * 2));
    this.root.classList.toggle('flutter', st.flutter);
    this.root.classList.toggle('cheer', st.cheer);
    this.titleEl.style.opacity = st.title ? '1' : '0';
    if (st.panel && !this.panelShown) {
      this.panelShown = true;
      this.onPanel();
    }
  }
}
