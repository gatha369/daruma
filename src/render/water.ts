// 水面：墨を薄く流したような波紋（世界に固定された模様なので、進むと流れて見える）
import * as THREE from 'three';
import { Palette } from '../game/scenery';
import { setRGB } from './textures';

const vertex = /* glsl */ `
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
precision highp float;
uniform vec3 uWater;
uniform vec3 uInk;
uniform float uInkStrength;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform int uDetail;
varying vec3 vWorld;
varying float vDepth;

// 大きな座標でも崩れにくい乱数
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    if (i >= uDetail) break;
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  // 横に長くのびる波の線になるよう、左右方向を引き伸ばす
  vec2 p = vec2(vWorld.x * 0.07, vWorld.z * 0.34);
  float n = fbm(p + vec2(uTime * 0.02, uTime * 0.05));
  // ノイズの等高線を、細い墨の線として描く
  float c = fract(n * 5.0);
  float line = smoothstep(0.07, 0.0, min(c, 1.0 - c));
  // 川の外（両岸の向こう）は線を控えめにする
  line *= mix(0.3, 1.0, 1.0 - smoothstep(6.0, 9.0, abs(vWorld.x)));
  // 線は濃い所と薄い所がまだらに出る（墨のにじみ）
  float wash = noise(p * 0.45 + vec2(3.7, uTime * 0.01));
  line *= smoothstep(0.3, 0.75, wash);
  // 遠くは線が細かくなりすぎるので薄くする
  line *= 1.0 - smoothstep(25.0, 85.0, vDepth);
  float tone = (wash - 0.5) * 0.18;
  float k = clamp(line * uInkStrength + tone * uInkStrength, 0.0, 1.0);
  vec3 col = mix(uWater, uInk, k);
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  #include <colorspace_fragment>
}
`;

export class Water {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uWater: { value: new THREE.Color() },
        uInk: { value: new THREE.Color() },
        uInkStrength: { value: 0.5 },
        uFogColor: { value: new THREE.Color() },
        uFogNear: { value: 30 },
        uFogFar: { value: 120 },
        uTime: { value: 0 },
        uDetail: { value: 4 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 320), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
  }

  setDetail(n: number) { this.mat.uniforms.uDetail.value = n; }

  update(p: Palette, time: number, leafZ: number) {
    const u = this.mat.uniforms;
    setRGB(u.uWater.value, p.water);
    setRGB(u.uInk.value, p.ink);
    setRGB(u.uFogColor.value, p.fog);
    u.uInkStrength.value = p.inkStrength;
    u.uFogNear.value = p.fogNear;
    u.uFogFar.value = p.fogFar;
    u.uTime.value = time;
    this.mesh.position.z = leafZ - 100;
  }
}
