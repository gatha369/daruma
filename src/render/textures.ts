// プログラムで描く画像（外部の素材は使わない）と、墨の濃淡の塗り方
import * as THREE from 'three';
import { RGB } from '../game/scenery';

/** 3段階の濃淡（水墨画のように、なめらかすぎない陰影） */
let toonMap: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (toonMap) return toonMap;
  const data = new Uint8Array([90, 170, 255]);
  toonMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  toonMap.minFilter = toonMap.magFilter = THREE.NearestFilter;
  toonMap.needsUpdate = true;
  return toonMap;
}

export function toon(color: number, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

/** 墨の輪郭線（裏返した少し大きい形を黒く塗る） */
export const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x141312, side: THREE.BackSide });

export function setRGB(c: THREE.Color, rgb: RGB) {
  c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}

function canvasTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 種つきの乱数 */
export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 渦巻き（白で描き、色は材質の色で付ける） */
export function whirlTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  for (let arm = 0; arm < 3; arm++) {
    for (let i = 0; i < 200; i++) {
      const a0 = (i / 200) * Math.PI * 4 + (arm * Math.PI * 2) / 3;
      const a1 = ((i + 1) / 200) * Math.PI * 4 + (arm * Math.PI * 2) / 3;
      const r0 = 10 + (i / 200) * 115;
      const r1 = 10 + ((i + 1) / 200) * 115;
      g.beginPath();
      g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
      g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
      // 筆のように、内側は太く濃く、外へ行くほど細くかすれる
      g.strokeStyle = `rgba(255,255,255,${0.75 * (1 - i / 230)})`;
      g.lineWidth = 9 * (1 - i / 260);
      g.lineCap = 'round';
      g.stroke();
    }
  }
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, 30, 0, Math.PI * 2);
  g.fill();
  return canvasTexture(c);
}

/** 筆で横に払った短い線（横向きの流れの模様） */
export function strokeTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 128; x++) {
    const k = x / 127;
    const thick = Math.sin(Math.PI * Math.pow(k, 0.7)) * 6; // 入りは太く、抜けは細く
    g.fillStyle = `rgba(255,255,255,${0.9 * (1 - k * 0.6)})`;
    g.fillRect(x, 8 - thick / 2, 1, thick);
  }
  return canvasTexture(c);
}

/** 遠景の山の稜線（上が濃く、下は霧に溶ける） */
export function mountainTexture(seed: number, roughness: number): THREE.Texture {
  const W = 1024;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rng = mulberry(seed);
  const waves = Array.from({ length: 6 }, (_, i) => ({
    f: (i + 1) * (1 + rng()) * 1.3, p: rng() * Math.PI * 2, a: Math.pow(0.55, i) * (0.5 + rng()),
  }));
  const ridge = (x: number) => {
    let y = 0;
    for (const w of waves) y += Math.sin((x / W) * Math.PI * 2 * w.f + w.p) * w.a;
    // 左右の端がつながるよう、周期の整数倍の波だけを使う代わりに、端で高さをそろえる
    return y;
  };
  const top: number[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let x = 0; x < W; x++) {
    const y = ridge(x) + (rng() - 0.5) * roughness * 0.08;
    top.push(y);
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  for (let x = 0; x < W; x++) {
    const peak = H * (0.65 - 0.6 * ((top[x] - min) / (max - min))); // 稜線の高さ（上ほど小さい）
    const grd = g.createLinearGradient(0, peak, 0, H);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.12, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x, peak, 1, H - peak);
  }
  return canvasTexture(c);
}

/** ぼんやりした丸（夕日・月） */
export function discTexture(soft: number): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1 - soft, 'rgba(255,255,255,1)');
  grd.addColorStop(1 - soft * 0.5, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c);
}

/** 横にたなびく霧の帯（左右にくり返しつながる） */
export function mistTexture(seed: number): THREE.Texture {
  const W = 512;
  const H = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rng = mulberry(seed);
  for (let i = 0; i < 40; i++) {
    const x = rng() * W;
    const y = H * (0.35 + rng() * 0.3);
    const rx = 40 + rng() * 90;
    const ry = 6 + rng() * 10;
    for (const dx of [-W, 0, W]) {
      const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
      grd.addColorStop(0, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.save();
      g.translate(x + dx, y);
      g.scale(1, ry / rx);
      g.translate(-(x + dx), -y);
      g.beginPath();
      g.arc(x + dx, y, rx, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  const t = canvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** 和紙のざらつき（画面全体にうっすら重ねる） */
export function paperDataURL(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  const img = g.createImageData(160, 160);
  const rng = mulberry(9);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + rng() * 55;
    img.data[i] = v;
    img.data[i + 1] = v - 4;
    img.data[i + 2] = v - 10;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // 和紙の繊維のような細い筋
  g.strokeStyle = 'rgba(120,110,95,0.12)';
  for (let i = 0; i < 30; i++) {
    g.beginPath();
    const x = rng() * 160;
    const y = rng() * 160;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rng() * 20 - 10, y + rng() * 20 - 10, x + rng() * 30 - 15, y + rng() * 30 - 15);
    g.stroke();
  }
  return c.toDataURL();
}
