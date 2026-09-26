// Draw an ARECanvasPrims frame (app/canvas_prims.cpp) with WebGL 2.
//
// This replays what engine/ARECanvasOGL.cpp did with OpenGL 1.1: identity matrices,
// clip-space vertices with per-vertex colour, alpha blending, and textures in DECAL or
// MODULATE mode (linear, repeating) -- with one deliberate difference. That canvas
// cleared depth between LiveStyle passes, which is fine for one object in one style but
// lets a whole later-pass part paint over nearer parts in a multi-style .pcs scene (the
// anime girl's hair, pass 1, covered her face, pass 0). Here depth is kept for the
// frame and each later pass is pulled slightly toward the eye instead, so it still wins
// over the same surface (halos, outlines) but not over geometry in front of it.

const VS = `#version 300 es
in vec4 a_pos;
in vec4 a_col;
in vec2 a_uv;
uniform float u_bias; // pulls later passes a hair toward the eye (see draw)
out vec4 v_col;
out vec2 v_uv;
void main() { gl_Position = a_pos; gl_Position.z -= u_bias * a_pos.w; v_col = a_col; v_uv = a_uv; }`;

const FS = `#version 300 es
precision mediump float;
in vec4 v_col;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform int u_mode; // 0 untextured, 1 decal, 2 modulate
out vec4 o;
void main() {
  if (u_mode == 0) { o = v_col; return; }
  vec4 t = texture(u_tex, v_uv);
  // GL_DECAL: texture over the fragment by the texture's alpha; GL_MODULATE: multiply.
  o = u_mode == 1 ? vec4(mix(v_col.rgb, t.rgb, t.a), v_col.a) : v_col * t;
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const loc = {
    pos: gl.getAttribLocation(prog, 'a_pos'),
    col: gl.getAttribLocation(prog, 'a_col'),
    uv: gl.getAttribLocation(prog, 'a_uv'),
    mode: gl.getUniformLocation(prog, 'u_mode'),
    tex: gl.getUniformLocation(prog, 'u_tex'),
    bias: gl.getUniformLocation(prog, 'u_bias'),
  };
  const buf = gl.createBuffer();
  const textures = new Map(); // engine bitmap id -> WebGLTexture

  function texture(E, i) {
    const info = E.HEAPU32.subarray(E._tf_texture(i) >> 2, (E._tf_texture(i) >> 2) + 4);
    const [id, w, h, ptr] = info;
    let t = textures.get(id);
    if (!t) {
      t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, E.HEAPU8.subarray(ptr, ptr + w * h * 4));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      textures.set(id, t);
    }
    return t;
  }

  // Render the Studio's current scene at (w, h) CSS pixels into this canvas.
  // Returns the number of triangles drawn.
  function draw(E, w, h, dpr = 1) {
    const ptr = E._tf_render_prims(w, h);
    if (!ptr) throw new Error('engine render failed');
    const f = E.HEAPF32.subarray(ptr >> 2, (ptr >> 2) + E._tf_frame_length());
    const texIds = [];
    for (let i = 0; i < f[5]; i++) texIds.push(texture(E, i));

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(f[0], f[1], f[2], 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(prog);
    gl.uniform1i(loc.tex, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const stride = 10 * 4;
    gl.enableVertexAttribArray(loc.pos);
    gl.enableVertexAttribArray(loc.col);
    gl.enableVertexAttribArray(loc.uv);

    let p = 6, pass = -1, tris = 0;
    for (let b = 0; b < f[4]; b++) {
      const [bp, tex, modulate, n] = [f[p], f[p + 1], f[p + 2], f[p + 3]];
      p += 4;
      if (bp !== pass) { pass = bp; gl.uniform1f(loc.bias, bp * 2e-5); }
      gl.bufferData(gl.ARRAY_BUFFER, f.subarray(p, p + n * 10), gl.STREAM_DRAW);
      gl.vertexAttribPointer(loc.pos, 4, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(loc.col, 4, gl.FLOAT, false, stride, 16);
      gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 32);
      if (tex >= 0 && texIds[tex]) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texIds[tex]);
        gl.uniform1i(loc.mode, modulate ? 2 : 1);
      } else {
        gl.uniform1i(loc.mode, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, n);
      tris += n / 3;
      p += n * 10;
    }
    return tris;
  }

  // An empty page (File > New, or a catalog preview with nothing chosen).
  function clear(r, g, b) {
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  return { draw, clear, canvas };
}
