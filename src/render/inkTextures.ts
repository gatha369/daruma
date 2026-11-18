// 西別院版の絵（すべてプログラムで描く。外部の素材は使わない）
// 墨の線で描いた石垣・地面・和紙・達磨の顔と衣・遠景の名古屋城・町並み・西掛所の大屋根
import * as THREE from 'three';
import { mulberry } from './textures';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** 筆の線（太さが少し揺れる、かすれた線） */
function brush(g: CanvasRenderingContext2D, pts: [number, number][], width: number, rng: () => number, alpha = 0.9) {
  for (let pass = 0; pass < 3; pass++) {
    g.beginPath();
    g.lineWidth = width * (1 - pass * 0.25);
    g.strokeStyle = `rgba(20,18,16,${alpha * (pass === 0 ? 0.55 : 0.8)})`;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    pts.forEach(([x, y], i) => {
      const jx = (rng() - 0.5) * width * 0.3;
      const jy = (rng() - 0.5) * width * 0.3;
      if (i === 0) g.moveTo(x + jx, y + jy);
      else g.lineTo(x + jx, y + jy);
    });
    g.stroke();
  }
}

/** 石垣：大小の石を墨の線で（横にくり返しつながる） */
export function stoneWallTexture(): THREE.Texture {
  const W = 512;
  const H = 128;
  const [c, g] = canvas(W, H);
  const rng = mulberry(77);
  g.fillStyle = '#b9b4aa';
  g.fillRect(0, 0, W, H);
  let y = 0;
  while (y < H) {
    const rowH = 22 + rng() * 16;
    let x = -rng() * 30;
    while (x < W) {
      const w = 34 + rng() * 40;
      const shade = 150 + Math.floor(rng() * 50);
      g.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`;
      g.beginPath();
      g.roundRect(x + 2, y + 2, w - 4, rowH - 4, 6);
      g.fill();
      g.strokeStyle = 'rgba(30,28,26,0.75)';
      g.lineWidth = 2.2;
      g.stroke();
      x += w;
    }
    y += rowH;
  }
  // 上の縁（地面との境）を濃く
  g.fillStyle = 'rgba(30,28,26,0.8)';
  g.fillRect(0, 0, W, 5);
  return tex(c, true);
}

/** 川岸の地面：和紙のような地に、淡い墨のかすれ */
export function groundTexture(): THREE.Texture {
  const S = 256;
  const [c, g] = canvas(S, S);
  const rng = mulberry(91);
  g.fillStyle = '#d9d4c8';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = 6 + rng() * 22;
    g.strokeStyle = `rgba(60,55,48,${0.08 + rng() * 0.12})`;
    g.lineWidth = 1 + rng() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y + (rng() - 0.5) * 4);
    g.stroke();
  }
  return tex(c, true);
}

/** 和紙：白い紙に、墨の細い縁取りと、うっすら繊維の模様 */
export function washiTexture(): THREE.Texture {
  const S = 128;
  const [c, g] = canvas(S, S);
  const rng = mulberry(13);
  g.fillStyle = '#fffdf7';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(150,140,120,${0.1 + rng() * 0.15})`;
    g.lineWidth = 0.8;
    const x = rng() * S;
    const y = rng() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (rng() - 0.5) * 20, y + (rng() - 0.5) * 20, x + (rng() - 0.5) * 30, y + (rng() - 0.5) * 30);
    g.stroke();
  }
  g.strokeStyle = 'rgba(25,22,20,0.9)';
  g.lineWidth = 6;
  g.strokeRect(4, 4, S - 8, S - 8);
  return tex(c);
}

/** 衣：白地に墨のひだ（色は材質の色で付ける。七色に光らせるときも同じ絵のまま色を変えられる） */
export function robeTexture(): THREE.Texture {
  const W = 512;
  const H = 256;
  const [c, g] = canvas(W, H);
  const rng = mulberry(5);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // 縦のひだ（下＝裾で太く、上＝頭巾で細い）。v は上が頭
  for (let i = 0; i < 9; i++) {
    const x = (i / 9) * W + rng() * 30;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 6; k++) {
      const y = H * (0.25 + (k / 6) * 0.75);
      pts.push([x + Math.sin(k * 0.9 + i) * 12, H - y]);
    }
    brush(g, pts, 4 + rng() * 5, rng, 0.45);
  }
  // 頭巾の縁（顔のまわり）と、肩の線
  brush(g, [[0, H * 0.32], [W * 0.5, H * 0.3], [W, H * 0.32]], 6, rng, 0.35);
  return tex(c);
}

/** 達磨の顔：ぎょろりとした大きな目、太い眉、鉤鼻、口ひげとあごひげ（北斎の大だるまの顔つきに寄せたオリジナル） */
export function darumaFaceTexture(): THREE.Texture {
  const S = 256;
  const [c, g] = canvas(S, S);
  const rng = mulberry(21);
  // 肌
  g.fillStyle = '#f1e2c8';
  g.beginPath();
  g.ellipse(128, 128, 124, 124, 0, 0, Math.PI * 2);
  g.fill();
  // 太い眉（八の字にはね上がる）
  brush(g, [[34, 92], [62, 70], [100, 82], [116, 96]], 16, rng);
  brush(g, [[222, 92], [194, 70], [156, 82], [140, 96]], 16, rng);
  // 眉間のしわ
  brush(g, [[122, 84], [124, 104]], 5, rng, 0.7);
  brush(g, [[134, 84], [132, 104]], 5, rng, 0.7);
  // 大きな目（白目と、片寄った黒目＝ぎょろり）
  for (const [ex, dir] of [[82, 1], [174, -1]] as const) {
    g.fillStyle = '#fbf8ef';
    g.beginPath();
    g.ellipse(ex, 118, 28, 24, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(20,18,16,0.95)';
    g.stroke();
    g.fillStyle = '#141210';
    g.beginPath();
    g.arc(ex + dir * 9, 114, 11, 0, Math.PI * 2);
    g.fill();
  }
  // 鉤鼻
  brush(g, [[128, 104], [118, 150], [112, 166], [124, 172], [140, 166]], 7, rng);
  // 口ひげ・あごひげ・口
  g.fillStyle = 'rgba(25,22,20,0.88)';
  g.beginPath();
  g.moveTo(64, 186);
  g.quadraticCurveTo(128, 160, 192, 186);
  g.quadraticCurveTo(170, 252, 128, 254);
  g.quadraticCurveTo(86, 252, 64, 186);
  g.fill();
  for (let i = 0; i < 14; i++) {
    const x = 72 + i * 8.5;
    brush(g, [[x, 196], [x + (rng() - 0.5) * 10, 236 + rng() * 14]], 2, rng, 0.6);
  }
  g.fillStyle = '#7a2a20';
  g.beginPath();
  g.ellipse(128, 196, 16, 6, 0, 0, Math.PI * 2);
  g.fill();
  return tex(c);
}

/** 遠景の名古屋城：石垣の上に、屋根が重なる天守の影（金の鯱を小さく） */
export function castleTexture(): THREE.Texture {
  const W = 256;
  const H = 256;
  const [c, g] = canvas(W, H);
  const ink = 'rgba(255,255,255,1)'; // 色は材質の色で付ける
  g.fillStyle = ink;
  // 石垣（台形）
  g.beginPath();
  g.moveTo(40, 256);
  g.lineTo(60, 196);
  g.lineTo(196, 196);
  g.lineTo(216, 256);
  g.fill();
  // 5重の屋根と壁
  const tiers = [
    { y: 196, w: 130, h: 26 }, { y: 168, w: 110, h: 24 }, { y: 142, w: 92, h: 22 },
    { y: 118, w: 74, h: 20 }, { y: 96, w: 56, h: 22 },
  ];
  for (const t of tiers) {
    g.fillRect(128 - t.w * 0.38, t.y - t.h, t.w * 0.76, t.h); // 壁
    // 反りのある屋根
    g.beginPath();
    g.moveTo(128 - t.w / 2 - 8, t.y - t.h + 6);
    g.quadraticCurveTo(128 - t.w / 2, t.y - t.h - 2, 128 - t.w * 0.3, t.y - t.h - 8);
    g.lineTo(128 + t.w * 0.3, t.y - t.h - 8);
    g.quadraticCurveTo(128 + t.w / 2, t.y - t.h - 2, 128 + t.w / 2 + 8, t.y - t.h + 6);
    g.lineTo(128 + t.w * 0.38, t.y - t.h);
    g.lineTo(128 - t.w * 0.38, t.y - t.h);
    g.fill();
  }
  // 鯱
  g.fillStyle = 'rgba(255,255,255,1)';
  g.fillRect(128 - 24, 62, 6, 10);
  g.fillRect(128 + 18, 62, 6, 10);
  return tex(c);
}

/** 遠景の町並み：蔵や町家の屋根が連なる影（横にくり返しつながる） */
export function roofsTexture(): THREE.Texture {
  const W = 1024;
  const H = 128;
  const [c, g] = canvas(W, H);
  const rng = mulberry(33);
  g.fillStyle = 'rgba(255,255,255,1)';
  let x = 0;
  while (x < W) {
    const w = 40 + rng() * 70;
    const h = 30 + rng() * 40;
    const top = H - h;
    g.fillRect(x + 4, top + 12, w - 8, h);
    // 切妻の屋根
    g.beginPath();
    g.moveTo(x, top + 16);
    g.lineTo(x + w / 2, top);
    g.lineTo(x + w, top + 16);
    g.fill();
    x += w + rng() * 6;
  }
  return tex(c, true);
}

/** 西掛所の大屋根：大きく反った入母屋の屋根と、その下の本堂の影 */
export function templeTexture(): THREE.Texture {
  const W = 512;
  const H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = 'rgba(255,255,255,1)';
  // 本堂の柱と壁
  g.fillRect(96, 150, 320, 106);
  // 大屋根（軒が大きく反る）
  g.beginPath();
  g.moveTo(10, 168);
  g.quadraticCurveTo(80, 150, 120, 92);
  g.lineTo(190, 40);
  g.lineTo(322, 40);
  g.lineTo(392, 92);
  g.quadraticCurveTo(432, 150, 502, 168);
  g.quadraticCurveTo(256, 150, 10, 168);
  g.fill();
  // 棟
  g.fillRect(176, 30, 160, 12);
  g.fillRect(170, 22, 10, 20);
  g.fillRect(332, 22, 10, 20);
  // 柱のすき間（明るく抜く）
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) g.fillRect(112 + i * 44, 184, 30, 72);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 7; i++) g.fillRect(112 + i * 44, 184, 30, 72);
  return tex(c);
}

/** 築地塀の壁：白い壁に5本の横線（定規筋） */
export function tsuijiTexture(): THREE.Texture {
  const W = 256;
  const H = 64;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#f2ede2';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(30,28,26,0.85)';
  g.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    const y = 14 + i * 7;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  return tex(c, true);
}

/** 柳の枝：上から垂れ下がる細い線（すき間は透ける） */
export function willowTexture(): THREE.Texture {
  const W = 256;
  const H = 128;
  const [c, g] = canvas(W, H);
  const rng = mulberry(57);
  for (let i = 0; i < 70; i++) {
    const x = rng() * W;
    const len = H * (0.5 + rng() * 0.5);
    g.strokeStyle = `rgba(255,255,255,${0.6 + rng() * 0.4})`;
    g.lineWidth = 1.5 + rng() * 2;
    g.beginPath();
    g.moveTo(x, 0);
    g.quadraticCurveTo(x + (rng() - 0.5) * 10, len * 0.5, x + (rng() - 0.5) * 6, len);
    g.stroke();
  }
  const t = tex(c, true);
  t.repeat.set(3, 1);
  return t;
}
