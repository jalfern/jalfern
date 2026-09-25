// Draw LiveArt EPS onto a 2D canvas.
//
// ARECanvasEPS (engine/ARECanvasEPS.cpp) writes a small PostScript subset:
// newpath / moveto / lineto / closepath / fill / stroke / setrgbcolor / setlinewidth,
// already depth-sorted by the engine's painter's algorithm. This interprets exactly
// that subset; anything else is reported, not guessed at.

export function parseEPS(text) {
  const bbox = /%%BoundingBox:\s*\S+\s+\S+\s+(\S+)\s+(\S+)/.exec(text);
  const width = bbox ? +bbox[1] : 640;
  const height = bbox ? +bbox[2] : 480;
  const ops = [];
  const stack = [];
  let path = [];
  let color = '#000';
  let lineWidth = 1;
  const body = text.replace(/%[^\n]*/g, '');
  for (const tok of body.split(/\s+/)) {
    if (!tok) continue;
    switch (tok) {
      case 'newpath': path = []; break;
      case 'moveto': case 'lineto': {
        const y = stack.pop(), x = stack.pop();
        path.push(x, height - y);
        break;
      }
      case 'closepath': break;
      case 'setrgbcolor': {
        const b = stack.pop(), g = stack.pop(), r = stack.pop();
        color = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
        break;
      }
      case 'setgray': { const v = Math.round(stack.pop() * 255); color = `rgb(${v},${v},${v})`; break; }
      case 'setlinewidth': lineWidth = stack.pop(); break;
      case 'fill': ops.push({ fill: true, color, path }); path = []; break;
      case 'stroke': ops.push({ fill: false, color, lineWidth, path }); path = []; break;
      case 'gsave': case 'grestore': case 'showpage': break;
      default: {
        const n = Number(tok);
        if (Number.isNaN(n)) throw new Error(`LiveArt EPS: unsupported operator ${tok}`);
        stack.push(n);
      }
    }
  }
  return { width, height, ops };
}

// Paint parsed ops into ctx, scaling the EPS page to (w, h).
export function drawEPS(ctx, eps, w, h, background) {
  ctx.save();
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.scale(w / eps.width, h / eps.height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const op of eps.ops) {
    const p = op.path;
    if (p.length < 4) continue;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    if (op.fill) {
      ctx.closePath();
      ctx.fillStyle = op.color;
      ctx.fill();
      // Hairline in the same colour hides the anti-aliasing seams between facets.
      ctx.strokeStyle = op.color;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    } else {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.lineWidth;
      ctx.stroke();
    }
  }
  ctx.restore();
}
