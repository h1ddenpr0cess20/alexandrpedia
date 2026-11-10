/**
 * A standalone Persian-style area rug for the Alexandrpedia reading room.
 * It owns its dimensions, woven colour/relief maps, bound perimeter and fringe,
 * and uses only engine GFX primitives so it can be moved into madness-engine.
 */

const PALETTE = Object.freeze({
  // Aged wool: tobacco, warm stone, olive, clay and softened linen.
  field: '#786b56', fieldLight: '#88775e', navy: '#443d32',
  ivory: '#cbbda1', gold: '#a58b60', teal: '#73745b',
  coral: '#98715a', dark: '#43392f',
});

export const RUG_DEFAULTS = Object.freeze({
  width: 3.8, depth: 3.15, thickness: 0.018, fringeLength: 0.075,
});

function random(seed = 7319) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strokeFrame(ctx, x, y, width, height, inset, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);
}

function flower(ctx, x, y, radius, palette, petals = 8, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.lineJoin = 'round';
  for (let i = 0; i < petals; i++) {
    ctx.rotate(Math.PI * 2 / petals);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-radius * 0.24, -radius * 0.28, -radius * 0.32, -radius * 0.78, 0, -radius);
    ctx.bezierCurveTo(radius * 0.32, -radius * 0.78, radius * 0.24, -radius * 0.28, 0, 0);
    ctx.fillStyle = i % 3 === 0 ? palette.teal : i % 3 === 1 ? palette.ivory : palette.coral;
    ctx.fill();
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = Math.max(1, radius * 0.045);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.12);
    ctx.quadraticCurveTo(radius * 0.04, -radius * 0.5, 0, -radius * 0.83);
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = Math.max(0.8, radius * 0.025);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = palette.gold;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.restore();
}

function leaf(ctx, x, y, size, angle, palette, fill = palette.teal) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.15, -size * 0.55, size, -size * 0.62);
  ctx.quadraticCurveTo(size * 0.84, size * 0.02, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = Math.max(0.8, size * 0.035);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.08, -size * 0.06);
  ctx.quadraticCurveTo(size * 0.47, -size * 0.29, size * 0.89, -size * 0.55);
  ctx.strokeStyle = palette.ivory;
  ctx.lineWidth = Math.max(0.6, size * 0.022);
  ctx.stroke();
  ctx.restore();
}

function paisley(ctx, x, y, size, angle, palette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.62);
  ctx.bezierCurveTo(-size * 0.82, size * 0.3, -size * 0.45, -size * 0.56, 0, -size);
  ctx.bezierCurveTo(size * 0.64, -size * 0.42, size * 0.47, size * 0.24, 0, size * 0.62);
  ctx.fillStyle = palette.teal;
  ctx.fill();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, size * 0.42);
  ctx.bezierCurveTo(-size * 0.43, size * 0.12, -size * 0.18, -size * 0.45, 0, -size * 0.72);
  ctx.bezierCurveTo(size * 0.36, -size * 0.29, size * 0.26, size * 0.14, 0, size * 0.42);
  ctx.strokeStyle = palette.ivory;
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.stroke();
  flower(ctx, 0, -size * 0.15, size * 0.14, palette, 5);
  ctx.restore();
}

function cornerSprig(ctx, x, y, sx, sy, palette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(70, 20, 54, 110, 190, 178);
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(26, 12);
  ctx.bezierCurveTo(80, 50, 100, 92, 166, 156);
  ctx.strokeStyle = palette.ivory;
  ctx.lineWidth = 2;
  ctx.stroke();
  leaf(ctx, 42, 25, 36, -0.65, palette);
  leaf(ctx, 67, 55, 34, 2.3, palette, palette.coral);
  leaf(ctx, 79, 89, 39, -0.72, palette);
  leaf(ctx, 112, 119, 38, 2.35, palette, palette.coral);
  leaf(ctx, 143, 146, 31, -0.65, palette);
  flower(ctx, 96, 82, 26, palette, 8, 0.15);
  flower(ctx, 165, 166, 17, palette, 6, 0.4);
  ctx.restore();
}

function star(ctx, x, y, outerX, outerY, innerRatio, points, palette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points;
    const r = i % 2 ? innerRatio : 1;
    const px = Math.cos(a) * outerX * r;
    const py = Math.sin(a) * outerY * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = palette.navy;
  ctx.fill();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function borderMotifs(ctx, width, height, palette) {
  const top = 57;
  const gap = 42;
  for (let x = 90; x < width - 70; x += gap) {
    flower(ctx, x, top, 10, palette, 6, Math.PI / 6);
    flower(ctx, x, height - top, 10, palette, 6, Math.PI / 6);
  }
  for (let y = 102; y < height - 75; y += gap) {
    flower(ctx, top, y, 10, palette, 6, Math.PI / 6);
    flower(ctx, width - top, y, 10, palette, 6, Math.PI / 6);
  }
  for (const y of [top - 18, height - top + 18]) {
    for (let x = 80; x < width - 70; x += 21) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = palette.gold;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
  }
}

function paintDesign(ctx, width, height, palette) {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, palette.fieldLight);
  background.addColorStop(0.48, palette.field);
  background.addColorStop(1, palette.dark);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.navy;
  ctx.fillRect(22, 22, width - 44, height - 44);
  strokeFrame(ctx, 22, 22, width - 44, height - 44, 7, palette.gold, 4);
  strokeFrame(ctx, 22, 22, width - 44, height - 44, 15, palette.ivory, 2);
  strokeFrame(ctx, 22, 22, width - 44, height - 44, 22, palette.gold, 2);
  borderMotifs(ctx, width, height, palette);
  strokeFrame(ctx, 22, 22, width - 44, height - 44, 34, palette.ivory, 2);

  ctx.fillStyle = palette.field;
  ctx.fillRect(112, 112, width - 224, height - 224);
  strokeFrame(ctx, 112, 112, width - 224, height - 224, 0, palette.gold, 7);
  strokeFrame(ctx, 112, 112, width - 224, height - 224, 12, palette.ivory, 2);
  strokeFrame(ctx, 112, 112, width - 224, height - 224, 20, palette.teal, 3);
  strokeFrame(ctx, 112, 112, width - 224, height - 224, 28, palette.gold, 2);

  cornerSprig(ctx, 144, 144, 1, 1, palette);
  cornerSprig(ctx, width - 144, 144, -1, 1, palette);
  cornerSprig(ctx, 144, height - 144, 1, -1, palette);
  cornerSprig(ctx, width - 144, height - 144, -1, -1, palette);

  for (const x of [width * 0.34, width * 0.66]) {
    paisley(ctx, x, height * 0.5, 57, x < width / 2 ? -Math.PI / 2 : Math.PI / 2, palette);
  }
  for (const y of [height * 0.29, height * 0.71]) {
    paisley(ctx, width * 0.5, y, 42, y < height / 2 ? 0 : Math.PI, palette);
  }
  for (const x of [width * 0.25, width * 0.75]) {
    flower(ctx, x, height * 0.25, 22, palette, 8, Math.PI / 8);
    flower(ctx, x, height * 0.75, 22, palette, 8, Math.PI / 8);
  }

  star(ctx, width / 2, height / 2, 235, 205, 0.82, 16, palette);
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, 192, 166, 0, 0, Math.PI * 2);
  ctx.fillStyle = palette.fieldLight;
  ctx.fill();
  ctx.strokeStyle = palette.ivory;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, 176, 150, 0, 0, Math.PI * 2);
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 4;
  ctx.stroke();
  star(ctx, width / 2, height / 2, 132, 116, 0.76, 12, palette);
  flower(ctx, width / 2, height / 2, 95, palette, 12, Math.PI / 12);
  flower(ctx, width / 2, height / 2, 43, palette, 10, 0);
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 17, 0, Math.PI * 2);
  ctx.fillStyle = palette.ivory;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 8, 0, Math.PI * 2);
  ctx.fillStyle = palette.coral;
  ctx.fill();

  for (const x of [width * 0.28, width * 0.72]) {
    flower(ctx, x, height / 2, 30, palette, 10, Math.PI / 10);
  }
}

function paintCanvas() {
  if (typeof document === 'undefined') return null;
  const width = 1200, height = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Keep the medallion and borders, but omit pixel-scale yarn speckles that alias
  // into crawling lines when the camera moves across the rug.
  paintDesign(ctx, width, height, PALETTE);
  return canvas;
}

function textureOf(GFX, canvas) {
  if (!canvas) return null;
  const texture = new GFX.CanvasTexture(canvas);
  texture.colorSpace = GFX.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = GFX.LinearMipmapLinearFilter;
  texture.magFilter = GFX.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function fringeGeometry(GFX, width, depth, surfaceY, fringeLength) {
  const geometry = new GFX.BufferGeometry();
  const positions = [];
  const indices = [];
  const rand = random(91827);
  const count = Math.max(120, Math.round(width * 64));

  for (const end of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + 0.018 + (width - 0.036) * ((i + 0.5) / count);
      const yarnWidth = 0.0012 + rand() * 0.0015;
      const length = fringeLength * (0.72 + rand() * 0.55);
      const phase = rand() * Math.PI * 2;
      const base = positions.length / 3;

      for (let segment = 0; segment <= 3; segment++) {
        const t = segment / 3;
        const centerX = x + Math.sin(phase + t * Math.PI * 2) * 0.0018;
        const centerZ = end * (depth / 2 - 0.002 + length * t);
        const y = surfaceY + 0.0004 + Math.sin(phase + t * Math.PI) * 0.0005;
        positions.push(centerX - yarnWidth / 2, y, centerZ);
        positions.push(centerX + yarnWidth / 2, y, centerZ);
      }

      for (let segment = 0; segment < 3; segment++) {
        const a = base + segment * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        if (end > 0) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
  }

  geometry.setIndex(indices);
  geometry.setAttribute('position', new GFX.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Build a woven, fringed Persian area rug. Coordinates are metres; the origin
 * is in the centre on the floor. The returned group is self-contained.
 */
export function createPersianRug(GFX, options = {}) {
  const o = { ...RUG_DEFAULTS, ...options };
  if (!(Number.isFinite(o.width) && o.width >= 1 && o.width <= 8)) {
    throw new RangeError('rug width must be between 1 and 8 metres.');
  }
  if (!(Number.isFinite(o.depth) && o.depth >= 1 && o.depth <= 8)) {
    throw new RangeError('rug depth must be between 1 and 8 metres.');
  }
  if (!(Number.isFinite(o.thickness) && o.thickness >= 0.004 && o.thickness <= 0.06)) {
    throw new RangeError('rug thickness must be between 0.004 and 0.06 metres.');
  }
  if (!(Number.isFinite(o.fringeLength) && o.fringeLength >= 0.015 && o.fringeLength <= 0.2)) {
    throw new RangeError('rug fringeLength must be between 0.015 and 0.2 metres.');
  }

  const group = new GFX.Group();
  group.name = 'ornate Persian rug';
  const colorMap = textureOf(GFX, paintCanvas());
  // Color-only pile avoids high-frequency bump variation, while the detailed
  // woven illustration remains visible at normal viewing distances.
  const pile = new GFX.MeshStandardMaterial({
    color: '#ffffff',
    map: colorMap,
    roughness: 1,
    metalness: 0,
  });
  const binding = new GFX.MeshStandardMaterial({ color: '#927b55', roughness: 0.9, metalness: 0 });
  const foundation = new GFX.MeshStandardMaterial({ color: '#514638', roughness: 1, metalness: 0 });
  const fringe = new GFX.MeshStandardMaterial({ color: '#c7b99d', roughness: 1, metalness: 0, side: GFX.DoubleSide });

  const base = new GFX.Mesh(new GFX.BoxGeometry(o.width, o.thickness, o.depth), foundation);
  base.name = 'rug foundation';
  base.position.y = o.thickness / 2;
  base.castShadow = false;
  base.receiveShadow = false;
  group.add(base);

  const surface = new GFX.Mesh(new GFX.PlaneGeometry(o.width - 0.02, o.depth - 0.02), pile);
  surface.name = 'woven Persian pile';
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = o.thickness + 0.001;
  surface.castShadow = false;
  surface.receiveShadow = false;
  group.add(surface);

  const cordY = o.thickness + 0.002;
  const cordHeight = 0.004;
  const longCord = new GFX.BoxGeometry(o.width - 0.025, cordHeight, 0.008);
  for (const z of [-1, 1]) {
    const cord = new GFX.Mesh(longCord, binding);
    cord.name = z < 0 ? 'rear gold selvedge' : 'front gold selvedge';
    cord.position.set(0, cordY, z * (o.depth / 2 - 0.006));
    cord.castShadow = false;
    cord.receiveShadow = false;
    group.add(cord);
  }
  const shortCord = new GFX.BoxGeometry(0.008, cordHeight, o.depth - 0.025);
  for (const x of [-1, 1]) {
    const cord = new GFX.Mesh(shortCord, binding);
    cord.name = x < 0 ? 'left gold selvedge' : 'right gold selvedge';
    cord.position.set(x * (o.width / 2 - 0.006), cordY, 0);
    cord.castShadow = true;
    group.add(cord);
  }

  const fringeMesh = new GFX.Mesh(
    fringeGeometry(GFX, o.width - 0.025, o.depth, o.thickness + 0.001, o.fringeLength),
    fringe,
  );
  fringeMesh.name = 'hand-knotted ivory fringe';
  fringeMesh.castShadow = false;
  fringeMesh.receiveShadow = false;
  group.add(fringeMesh);

  group.userData.dimensions = {
    width: o.width, depth: o.depth, thickness: o.thickness, fringeLength: o.fringeLength,
  };
  group.userData.materials = { pile, binding, foundation, fringe };
  return {
    group, pile, binding, foundation, fringe,
    dimensions: { ...group.userData.dimensions },
    frame: {
      center: [0, o.thickness / 2, 0],
      radius: Math.hypot(o.width, o.depth + o.fringeLength * 2, o.thickness) / 2 * 1.1,
    },
  };
}

/** Engine-compatible registration shape so the rug can be imported by the asset viewer later. */
export const assetViewer = Object.freeze({
  id: 'persian-rug',
  name: 'Persian rug (hand-woven, fringed)',
  category: 'Props',
  group: 'furnishings',
  options: {},
  build({ GFX, ...options }) {
    return createPersianRug(GFX, options);
  },
});
