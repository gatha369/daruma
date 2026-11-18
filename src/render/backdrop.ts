// 遠景：霧の中に重なる山の稜線、たなびく霧の帯、道のりに合わせた名古屋城・町並み・西掛所の大屋根
import * as THREE from 'three';
import { Palette, RGB, sceneWeights, kakeshoApproach } from '../game/scenery';
import { discTexture, mistTexture, mountainTexture, setRGB } from './textures';
import { castleTexture, roofsTexture, templeTexture } from './inkTextures';

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

interface Layer { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; depth: number }

export class Backdrop {
  group = new THREE.Group(); // 葉と一緒に前へ進む（遠景は近づいてこない）
  mistGroup = new THREE.Group();
  private mountains: Layer[] = [];
  private mists: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; speed: number }[] = [];
  private sun: THREE.Mesh;
  private moon: THREE.Mesh;
  private castle: THREE.Mesh;
  private roofs: THREE.Mesh;
  private temple: THREE.Mesh;

  constructor() {
    // 奥の山ほど霧の色に近く、高く、なだらか
    const specs = [
      { z: -360, w: 1100, h: 38, seed: 31, rough: 0.3, depth: 0.75 },
      { z: -320, w: 950, h: 30, seed: 17, rough: 0.6, depth: 0.5 },
      { z: -280, w: 820, h: 22, seed: 5, rough: 1, depth: 0.2 },
    ];
    specs.forEach((s, i) => {
      const mat = new THREE.MeshBasicMaterial({
        map: mountainTexture(s.seed, s.rough), transparent: true, depthWrite: false, fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
      mesh.position.set((i - 1) * 40, s.h / 2 - 3, s.z);
      mesh.renderOrder = -10 + i;
      this.group.add(mesh);
      this.mountains.push({ mesh, mat, depth: s.depth });
    });

    const sunMat = new THREE.MeshBasicMaterial({ map: discTexture(0.25), transparent: true, depthWrite: false, fog: false, color: 0xd0603c });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), sunMat);
    this.sun.position.set(-70, 12, -400);
    this.sun.renderOrder = -20;
    this.group.add(this.sun);
    const moonMat = new THREE.MeshBasicMaterial({ map: discTexture(0.12), transparent: true, depthWrite: false, fog: false, color: 0xf1ede2 });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), moonMat);
    this.moon.position.set(150, 34, -400); // 文字と重ならないよう右寄りに
    this.moon.renderOrder = -20;
    this.group.add(this.moon);

    // ---- 道のりの目印（色は墨。霧に溶けるよう、遠いほど霧の色に寄せる） ----
    const landmark = (map: THREE.Texture, w: number, h: number, order: number) => {
      const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.renderOrder = order;
      this.group.add(mesh);
      return mesh;
    };
    // 名古屋城の天守：左手の遠くに
    this.castle = landmark(castleTexture(), 56, 56, -7);
    this.castle.position.set(-95, 22, -300);
    // 町並みの屋根の連なり（両岸の遠く）
    const roofs = roofsTexture();
    roofs.repeat.set(3, 1);
    this.roofs = landmark(roofs, 900, 22, -6);
    this.roofs.position.set(0, 8, -240);
    // 西掛所の大屋根：川の行く手に。近づくほど大きく、手前に
    this.temple = landmark(templeTexture(), 120, 60, -5);

    // 水面の上を漂う霧の帯（手前のものほど低く速い）
    [{ z: -35, y: 1.2, h: 5, s: 0.012 }, { z: -65, y: 2, h: 8, s: 0.008 }, { z: -105, y: 3, h: 12, s: 0.005 }].forEach((m, i) => {
      const mat = new THREE.MeshBasicMaterial({ map: mistTexture(40 + i), transparent: true, depthWrite: false, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, m.h), mat);
      mesh.position.set(0, m.y, m.z);
      this.mistGroup.add(mesh);
      this.mists.push({ mesh, mat, speed: m.s });
    });
    this.group.add(this.mistGroup);
  }

  update(p: Palette, time: number, leafZ: number, progress = 0) {
    this.group.position.z = leafZ;
    const w = sceneWeights(progress);
    for (const l of this.mountains) {
      setRGB(l.mat.color, mixRGB(p.mountain, p.fog, l.depth));
      l.mat.opacity = 1;
    }
    const ink = (m: THREE.Mesh, depth: number, opacity: number) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      setRGB(mat.color, mixRGB(p.ink, p.fog, depth));
      mat.opacity = opacity;
      m.visible = opacity > 0.01;
    };
    ink(this.castle, 0.45, w.castle);
    ink(this.roofs, 0.55, Math.min(1, w.town + w.kakesho * 0.6));
    // 西掛所：遠く（小さく薄い）→ 近く（大きく濃い）
    const a = kakeshoApproach(progress);
    const s = 0.45 + a * 0.3;
    this.temple.scale.set(s, s, 1);
    this.temple.position.set(6, 60 * s * 0.5 - 7, -340 + a * 90);
    ink(this.temple, 0.7 - a * 0.45, Math.min(1, a * 4));
    (this.sun.material as THREE.MeshBasicMaterial).opacity = p.sun;
    this.sun.visible = p.sun > 0.01;
    (this.moon.material as THREE.MeshBasicMaterial).opacity = p.moon;
    this.moon.visible = p.moon > 0.01;
    for (const m of this.mists) {
      setRGB(m.mat.color, mixRGB(p.fog, [1, 1, 1], 0.25 * (1 - p.dark)));
      m.mat.opacity = p.mist * 0.8;
      m.mat.map!.offset.x = time * m.speed;
    }
  }
}
