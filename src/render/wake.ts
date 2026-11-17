// 航跡：葉の後ろに、ハの字に広がっていく細い墨の線が残る
import * as THREE from 'three';
import { RGB } from '../game/scenery';
import { setRGB } from './textures';

const LIFE = 1.6; // 線が消えるまでの秒数
const MAX = 64;

export class Wake {
  mesh: THREE.Mesh;
  private points: { x: number; z: number; born: number }[] = [];
  private pos: Float32Array;
  private alpha: Float32Array;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.ShaderMaterial;
  private lastZ = Infinity;

  constructor() {
    // 2本の線 × 点の数 × 左右の縁
    this.pos = new Float32Array(2 * MAX * 2 * 3);
    this.alpha = new Float32Array(2 * MAX * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const idx: number[] = [];
    for (let line = 0; line < 2; line++) {
      const base = line * MAX * 2;
      for (let i = 0; i < MAX - 1; i++) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide, // 上から見て裏向きの面も描く
      uniforms: { uColor: { value: new THREE.Color() } },
      vertexShader: `attribute float alpha; varying float vA;
        void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying float vA;
        void main(){ gl_FragColor = vec4(uColor, vA);
        #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
  }

  reset() { this.points = []; this.lastZ = Infinity; }

  /** x, z：葉の後ろ端のワールド座標。moving：前に進んでいるか */
  update(x: number, z: number, time: number, ink: RGB) {
    setRGB(this.mat.uniforms.uColor.value, ink);
    if (z < this.lastZ - 0.25) { // 少し進むごとに点を足す
      this.points.unshift({ x, z, born: time });
      this.lastZ = z;
    }
    this.points = this.points.filter((p) => time - p.born < LIFE).slice(0, MAX);
    const n = this.points.length;
    for (let line = 0; line < 2; line++) {
      const side = line === 0 ? -1 : 1;
      for (let i = 0; i < MAX; i++) {
        const p = this.points[Math.min(i, n - 1)] ?? { x, z, born: time };
        const age = i === 0 ? 0 : (time - p.born) / LIFE;
        const spread = 0.12 + age * 0.7; // 後ろほど広がる
        const w = 0.025 + age * 0.05; // 後ろほど太く、ぼやける
        const cx = (i === 0 ? x : p.x) + side * spread;
        const cz = i === 0 ? z : p.z;
        const v = (line * MAX + i) * 2;
        this.pos.set([cx - w, 0.03, cz, cx + w, 0.03, cz], v * 3);
        const a = i < n ? Math.pow(Math.max(0, 1 - age), 1.5) * 0.7 : 0;
        this.alpha[v] = a;
        this.alpha[v + 1] = a;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}
