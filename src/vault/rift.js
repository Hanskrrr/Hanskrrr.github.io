// The way out of the shore (shore.js), drawn on the graphics card: a tear in the pixel world.
//
// Behind the tear is a slice of a set of dimension exactly 6.7. Along each of seven axes, space is cut
// into cells of 0.8 with gaps of 0.2, and inside a cell only a Cantor set remains: two copies of it,
// each shrunk to 0.4843, so log 2 / log(1 / 0.4843) = 0.957 per axis. Their product in seven
// dimensions has dimension 7 × 0.957 = 6.7, and a flat three-dimensional slice through it about
// 6.7 − 4 = 2.7: faceted, cracked at every scale, and never the same twice as the slice turns
// through the other four dimensions. One axis is held in a gap, so the view flies down an empty
// channel between two walls of this crystal.
//
// Around the tear the pixel world bends like light round something heavy, and near it the world
// comes apart in small blocks, showing the same crystal behind. Walking in tears it all away.
import { H, W } from './world-level.js';

const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
const FRAG = `
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes, uCenter, uCam;
uniform float uR, uNear, uPull, uTime, uFly, uPx, uWhite;
uniform vec4 uGlitch;                                   // band y, band height, slip, hue shift
uniform vec4 uA0, uA1, uX0, uX1, uY0, uY1, uZ0, uZ1;    // the slice: an origin and three axes in 7-D

const float CELL = 0.8;
const float KEEP = 0.4843;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Light the colour of the site's night: cyan, violet and rose, round and round.
vec3 hue(float x) {
  x = fract(x) * 3.0;
  vec3 a = vec3(0.05, 0.75, 1.0), b = vec3(0.55, 0.25, 1.0), c = vec3(1.0, 0.25, 0.6);
  return x < 1.0 ? mix(a, b, x) : x < 2.0 ? mix(b, c, x - 1.0) : mix(c, a, x - 2.0);
}

// Distance along one axis to the set: to the next cell across a gap, or to a crack inside the cell.
float axis(float x) {
  float u = fract(x);
  if (u > CELL) return min(u - CELL, 1.0 - u);
  float v = u / CELL, s = CELL;
  for (int i = 0; i < 4; i++) {                        // deeper cracks are finer than a pixel
    if (v < KEEP) { v /= KEEP; s *= KEEP; }
    else if (v > 1.0 - KEEP) { v = (v - 1.0 + KEEP) / KEEP; s *= KEEP; }
    else return min(v - KEEP, 1.0 - KEEP - v) * s;
  }
  return 0.0;
}
// The distance to a product of sets is the length of the distances along each axis. Also returns
// which axis is farthest, to colour each facet by the direction it faces in seven dimensions.
float dist(vec3 p, out float which) {
  vec4 a = uA0 + p.x * uX0 + p.y * uY0 + p.z * uZ0;
  vec4 b = uA1 + p.x * uX1 + p.y * uY1 + p.z * uZ1;
  vec4 da = vec4(axis(a.x), axis(a.y), axis(a.z), axis(a.w));
  vec3 db = vec3(axis(b.x), axis(b.y), axis(b.z));
  float m = da.x; which = 0.0;
  if (da.y > m) { m = da.y; which = 1.0; }
  if (da.z > m) { m = da.z; which = 2.0; }
  if (da.w > m) { m = da.w; which = 3.0; }
  if (db.x > m) { m = db.x; which = 4.0; }
  if (db.y > m) { m = db.y; which = 5.0; }
  if (db.z > m) { m = db.z; which = 6.0; }
  return sqrt(dot(da, da) + dot(db, db));
}
float dist(vec3 p) { float w; return dist(p, w); }

vec3 crystal(vec2 d) {
  vec2 uv = d / (uPx * 20.0 * (1.0 + uPull * uPull * 8.0));       // 20 world pixels ≈ one unit of view
  float turn = uTime * 0.05 + uPull * 1.5;
  uv = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * uv;
  vec3 ro = vec3(uCam, uFly);
  vec3 rd = normalize(vec3(uv * 1.1, 1.0));
  float t = 0.01, glow = 0.0, steps = 0.0, which = 0.0;
  bool hit = false;
  for (int i = 0; i < 90; i++) {
    float e = dist(ro + rd * t, which);
    glow += exp(-e * 70.0);
    if (e < 0.0004 + t * 0.0008) { hit = true; break; }
    t += e * 0.9;
    steps += 1.0;
    if (t > 12.0) break;
  }
  vec3 space = vec3(0.015, 0.01, 0.045) + hue(0.3 + uTime * 0.01 + uGlitch.w) * glow * 0.015;
  if (!hit) return space;
  vec3 p = ro + rd * t;
  vec2 k = vec2(1.0, -1.0) * 0.0007;
  vec3 n = normalize(k.xyy * dist(p + k.xyy) + k.yyx * dist(p + k.yyx) + k.yxy * dist(p + k.yxy) + k.xxx * dist(p + k.xxx));
  float face = max(dot(n, -rd), 0.0);
  vec3 tint = hue(which / 7.0 + uTime * 0.015 + uGlitch.w);
  vec3 c = tint * (0.02 + 0.16 * face);                              // dark glass
  c += tint * pow(1.0 - face, 3.0) * 0.9;                            // light along the edges
  c += mix(tint, vec3(1.0), 0.25) * smoothstep(14.0, 50.0, steps) * 1.1;   // light from the cracks
  c = 1.0 - exp(-c * 1.6);                                           // bright, never burnt out
  return mix(space, c, exp(-t * 0.18));
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  if (abs(fc.y - uGlitch.x) < uGlitch.y) fc.x += uGlitch.z;
  fc += (vec2(hash(vec2(uTime, 1.0)), hash(vec2(uTime, 2.0))) - 0.5) * uPull * uPx * 3.0;   // shaking
  vec2 d = fc - uCenter;
  vec2 q = d / vec2(0.62, 1.0);
  float ang = atan(q.y, q.x);
  float edge = 1.0 + 0.08 * sin(ang * 7.0 + uTime * 3.1) + 0.05 * sin(ang * 13.0 - uTime * 5.3)
             + 0.06 * hash(vec2(floor(uTime * 20.0), floor(ang * 5.0)));
  float r = length(q) / (uR * edge);                                 // 1 at the rim of the tear
  vec2 g = vec2(fc.x, uRes.y - fc.y) / uPx;                         // where this is in the pixel world
  vec2 block = floor(g / 2.0);
  float h = hash(block);
  float reach = 1.0 + uNear * 0.9 + pow(uPull, 1.6) * 60.0;
  bool torn = r < 1.0 + (reach - 1.0) * h * h || (r < reach + 0.6 && hash(block + floor(uTime * 9.0)) > 0.985);
  float flicker = 0.88 + 0.12 * hash(vec2(floor(uTime * 24.0), 7.0));
  vec3 c = vec3(0.0);
  if (r < 1.0 || torn) {
    c = crystal(d) * flicker;
  } else {
    // Light bending round the tear, a little differently for each colour.
    float bend = uR * (1.2 + uNear * 0.4 + uPull * 2.0);
    float fade = 1.0 / (1.0 + (r - 1.0) * (r - 1.0) * 0.12);        // bending less far away
    float split = 0.05 * (0.3 + uNear) * fade;
    vec3 spread = vec3(1.0 - split, 1.0, 1.0 + split);
    float dd = max(dot(d, d), 1.0) / fade;
    for (int i = 0; i < 3; i++) {
      float b = bend * (i == 0 ? spread.x : i == 1 ? spread.y : spread.z);
      vec2 s = uCenter + d - d * b * b / dd;
      vec2 at = vec2(s.x, uRes.y - s.y) / uPx / vec2(${W}.0, ${H}.0);
      vec3 texel = texture2D(uScene, at).rgb;
      if (i == 0) c.r = texel.r; else if (i == 1) c.g = texel.g; else c.b = texel.b;
    }
    vec3 light = hue(0.15 + 0.12 * sin(uTime * 0.7 + ang * 2.0) + uGlitch.w);
    c += light * exp(-(r - 1.0) * 7.0) * (0.6 + uNear * 0.6) * flicker;        // the rim
    c += light * exp(-(r - 1.0) * 1.1) * (0.08 + uNear * 0.14) * flicker;      // its light on the world around
  }
  gl_FragColor = vec4(mix(c, vec3(1.0), uWhite), 1.0);
}`;

// Planes among axes 1–6 to turn the slice in, each at its own speed. Axis 0 is never turned into
// the direction of flight, so the camera stays in its gap.
const TURNS = [[1, 4, 0.31], [2, 5, 0.23], [3, 6, 0.17], [1, 6, 0.13], [4, 5, 0.29], [2, 3, 0.11], [5, 6, 0.19], [1, 3, 0.07]];

export function createRift(canvas) {
  canvas.style.imageRendering = 'pixelated';
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
  const u = {};
  for (const name of ['uRes', 'uCenter', 'uCam', 'uR', 'uNear', 'uPull', 'uTime', 'uFly', 'uPx', 'uWhite', 'uGlitch', 'uA0', 'uA1', 'uX0', 'uX1', 'uY0', 'uY1', 'uZ0', 'uZ1']) u[name] = gl.getUniformLocation(program, name);

  const phase = TURNS.map((_, i) => i * 0.9);
  let fly = 0;
  let quality = 1;   // share of full resolution; lowered by itself if frames come too slowly
  let slow = 0;
  let glitch = 0;
  let jump = null;
  let band = [0, 0, 0, 0];
  const rand = (a, b) => a + Math.random() * (b - a);
  const turn = v => {
    TURNS.forEach(([a, b], i) => { const c = Math.cos(phase[i]); const s = Math.sin(phase[i]); const va = v[a]; v[a] = va * c - v[b] * s; v[b] = va * s + v[b] * c; });
    return v;
  };
  const unit = k => Array.from({ length: 7 }, (_, i) => (i === k ? 1 : 0));
  const put = (name, v, from) => gl.uniform4f(u[name], v[from], v[from + 1], v[from + 2], from ? 0 : v[3]);

  return {
    /** One frame. x, y: the tear's centre in world pixels; near, pull, white: 0…1. */
    draw({ scene, x, y, near, pull, white, t, dt, cam, still }) {
      slow = slow * 0.97 + (dt > 0.026 ? 0.03 : 0);
      if (slow > 0.5 && quality > 0.2) { quality *= 0.75; slow = 0; }
      const k = pull > 0.1 ? Math.min(quality, 0.6) : quality;
      const n = Math.max(1, Math.floor(canvas.clientWidth * (devicePixelRatio || 1) * k / W));   // screen pixels per world pixel
      const w = W * n;
      const h = H * n;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      const px = w / W;

      if (!still) {
        const speed = 0.5 * (1 + near * 1.5 + pull * 10);
        TURNS.forEach(([, , s], i) => { phase[i] += dt * s * speed; });
        fly += dt * (0.16 + near * 0.2 + pull * pull * 9);
        if (glitch > 0) glitch--;
        else if (Math.random() < 0.02 + near * 0.05 + pull * 0.3) {
          glitch = Math.floor(rand(1, 5));
          jump = Array.from({ length: 7 }, (_, i) => (i ? rand(-0.35, 0.35) : 0));
          band = [rand(0, h), rand(2, 30) * px / 5, rand(-1, 1) * px * 6, rand(0.1, 0.5)];
        }
        if (!glitch) { jump = null; band = [0, 0, 0, 0]; }
      }
      const lean = 0.38 + 0.1 * Math.sin(t * 0.13);
      const X = turn(unit(1)).map((v, i) => (i ? v * Math.cos(lean) : Math.sin(lean)));
      const Y = turn(unit(2));
      const Z = turn(unit(3));
      const A = Array.from({ length: 7 }, (_, i) => (i ? 0.37 * i + 0.6 * Math.sin(t * 0.03 * (i + 1) + i) + (jump ? jump[i] : 0) : 0.9));

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform2f(u.uCenter, x * px, h - y * px);
      gl.uniform2f(u.uCam, cam * 0.05, 0);
      gl.uniform1f(u.uR, px * (12 + near * 4) * (1 + pull ** 2.2 * 22));
      gl.uniform1f(u.uNear, near);
      gl.uniform1f(u.uPull, pull);
      gl.uniform1f(u.uTime, t % 1000);
      gl.uniform1f(u.uFly, fly);
      gl.uniform1f(u.uPx, px);
      gl.uniform1f(u.uWhite, white);
      gl.uniform4f(u.uGlitch, ...band);
      put('uA0', A, 0); put('uA1', A, 4);
      put('uX0', X, 0); put('uX1', X, 4);
      put('uY0', Y, 0); put('uY1', Y, 4);
      put('uZ0', Z, 0); put('uZ1', Z, 4);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
