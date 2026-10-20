import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import type { ForestPalette, TreeTheme } from './forest-palette';

export function drawTree(ctx: DrawingContext, prop: Prop, theme: TreeTheme): void {
  const v = prop.variation;

  ctx.fillStyle = '#0a1a0a60';
  ctx.beginPath();
  ctx.ellipse(0.06, 0.1, 0.52, 0.44, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.trunk;
  ctx.fillRect(-0.06, 0.05, 0.12, 0.35);

  if (theme.variant === 'oak') {
    const canopyLayers = [
      { dx: -0.08, dy: -0.06, rx: 0.38, ry: 0.32, color: theme.canopyDark },
      { dx: 0.06, dy: -0.12, rx: 0.34, ry: 0.28, color: theme.canopyMid },
      { dx: -0.02, dy: -0.18, rx: 0.3, ry: 0.26, color: theme.canopyLight },
    ];
    for (const layer of canopyLayers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.ellipse(layer.dx, layer.dy, layer.rx, layer.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = theme.sheen;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.arc(-0.06, -0.2, 0.18, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const angle = v * 10 + i * 1.1;
      const dx = Math.cos(angle) * 0.22;
      const dy = Math.sin(angle) * 0.18 - 0.1;
      ctx.fillStyle = i % 2 ? theme.chipA : theme.chipB;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 0.06, 0.04, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.variant === 'pine') {
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const y = -0.05 - i * 0.14;
      const w = 0.35 - i * 0.06;
      const shade = theme.pineBase + i * theme.pineStep;
      ctx.fillStyle = `rgb(${shade} ${shade + theme.pineGreen} ${shade})`;
      ctx.beginPath();
      ctx.moveTo(0, y - 0.14);
      ctx.lineTo(-w, y + 0.04);
      ctx.lineTo(w, y + 0.04);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = theme.sheen;
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.moveTo(-0.15, -0.15);
    ctx.lineTo(0, -0.58);
    ctx.stroke();
  } else if (theme.variant === 'fey') {
    ctx.strokeStyle = theme.trunk;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.085;
    ctx.beginPath();
    ctx.moveTo(0.05, 0.38);
    ctx.quadraticCurveTo(-0.15, 0.2, -0.02, 0.04);
    ctx.quadraticCurveTo(0.12, -0.08, -0.03, -0.2);
    ctx.stroke();
    const lobes = [
      { dx: -0.16, dy: -0.3, rx: 0.17, ry: 0.15, color: theme.canopyDark },
      { dx: 0.15, dy: -0.24, rx: 0.15, ry: 0.13, color: theme.canopyMid },
      { dx: -0.02, dy: -0.44, rx: 0.16, ry: 0.14, color: theme.canopyLight },
    ];
    for (const [i, lobe] of lobes.entries()) {
      ctx.fillStyle = lobe.color;
      ctx.beginPath();
      ctx.ellipse(
        lobe.dx + Math.sin(v * 9 + i * 2.1) * 0.02,
        lobe.dy,
        lobe.rx,
        lobe.ry,
        Math.sin(v * 12 + i) * 0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.strokeStyle = theme.sheen;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.arc(-0.02, -0.36, 0.12, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const angle = v * 11 + i * 2.2;
      const dx = Math.cos(angle) * 0.16;
      const dy = -0.3 + Math.sin(angle) * 0.14;
      ctx.fillStyle = i % 2 ? theme.chipA : theme.chipB;
      ctx.beginPath();
      ctx.arc(dx, dy, 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = theme.canopyDark;
    ctx.beginPath();
    ctx.ellipse(0, -0.1, 0.4, 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.canopyMid;
    ctx.beginPath();
    ctx.ellipse(-0.04, -0.16, 0.3, 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.sheen;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.arc(-0.08, -0.2, 0.15, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const angle = v * 8 + i * 1.6;
      const dx = Math.cos(angle) * 0.18;
      const dy = Math.sin(angle) * 0.14 - 0.1;
      ctx.fillStyle = theme.chipA;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 0.05, 0.035, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawBoulder(ctx: DrawingContext, prop: Prop, moss: boolean): void {
  const v = prop.variation;
  ctx.fillStyle = '#1a2a1a80';
  ctx.beginPath();
  ctx.ellipse(0.04, 0.06, 0.36, 0.3, v * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a6a5e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.34, 0.28, v * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#728278';
  ctx.beginPath();
  ctx.ellipse(-0.03, -0.04, 0.24, 0.2, v * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a9a8e';
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.arc(-0.05, -0.06, 0.16, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.strokeStyle = '#4a5a4e';
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.moveTo(-0.1, 0.05);
  ctx.lineTo(0.08, 0.1);
  ctx.stroke();
  if (moss) {
    ctx.fillStyle = '#4a7a4a70';
    ctx.beginPath();
    ctx.ellipse(-0.08 + v * 0.06, 0.06, 0.12, 0.06, v * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a9a5a50';
    ctx.beginPath();
    ctx.ellipse(0.12 - v * 0.04, -0.08, 0.07, 0.035, -v * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFern(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  const v = prop.variation;
  const fronds = 4 + Math.floor(v * 3);
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2 + v * 2;
    const len = 0.2 + (i % 3) * 0.06;
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = i % 2 ? forest.fernStems[0] : forest.fernStems[1];
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -0.04, len, -0.02);
    ctx.stroke();
    for (let j = 0; j < 3; j++) {
      const t = 0.3 + j * 0.25;
      const lx = len * t;
      ctx.fillStyle = forest.fernLeaves;
      ctx.beginPath();
      ctx.ellipse(lx, -0.02, 0.03, 0.015, angle * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(lx, 0.02, 0.03, 0.015, -angle * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawMushroom(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  const v = prop.variation;
  const count = 2 + Math.floor(v * 2);
  for (let i = 0; i < count; i++) {
    const dx = (i - count / 2) * 0.12 + (v - 0.5) * 0.1;
    const dy = (i % 2) * 0.08;
    const size = 0.08 + (i % 2) * 0.04;
    ctx.fillStyle = forest.mushroomStem;
    ctx.fillRect(dx - 0.015, dy, 0.03, size * 1.2);
    const capColor = forest.mushroomCaps[i % 3] ?? forest.mushroomCaps[0];
    if (forest.mushroomGlow) {
      ctx.fillStyle = forest.mushroomGlow;
      ctx.beginPath();
      ctx.ellipse(dx, dy - size * 0.1, size * 2, size * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.ellipse(dx, dy, size, size * 0.6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff50';
    ctx.beginPath();
    ctx.ellipse(dx - size * 0.2, dy - size * 0.2, size * 0.15, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBush(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  const v = prop.variation;
  ctx.fillStyle = '#0a2a0a40';
  ctx.beginPath();
  ctx.ellipse(0.03, 0.06, 0.34, 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  const clumps = [
    { dx: -0.08, dy: -0.02, r: 0.2 },
    { dx: 0.08, dy: -0.04, r: 0.18 },
    { dx: 0, dy: -0.1, r: 0.22 },
  ];
  for (const clump of clumps) {
    ctx.fillStyle = v > 0.5 ? forest.bushClumps[0] : forest.bushClumps[1];
    ctx.beginPath();
    ctx.ellipse(clump.dx, clump.dy, clump.r, clump.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = forest.bushSheen;
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.arc(-0.04, -0.12, 0.1, Math.PI * 1.2, Math.PI * 1.6);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const angle = v * 6 + i * 1.5;
    const dx = Math.cos(angle) * 0.12;
    const dy = Math.sin(angle) * 0.08 - 0.05;
    ctx.fillStyle = forest.bushChips;
    ctx.beginPath();
    ctx.ellipse(dx, dy, 0.04, 0.025, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawLog(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  const v = prop.variation;
  const wood = forest.log;
  ctx.rotate((v - 0.5) * 0.8);
  ctx.fillStyle = '#0a1a0a60';
  ctx.fillRect(-0.42, -0.08, 0.88, 0.28);
  ctx.fillStyle = wood.base;
  ctx.fillRect(-0.46, -0.14, 0.88, 0.28);
  ctx.fillStyle = wood.grain;
  ctx.fillRect(-0.42, -0.1, 0.8, 0.2);
  ctx.strokeStyle = wood.edge;
  ctx.lineWidth = 0.02;
  ctx.strokeRect(-0.46, -0.14, 0.88, 0.28);
  ctx.strokeStyle = wood.rings;
  ctx.lineWidth = 0.012;
  for (let x = -0.3; x < 0.35; x += 0.12) {
    ctx.beginPath();
    ctx.moveTo(x, -0.08);
    ctx.lineTo(x, 0.08);
    ctx.stroke();
  }
  ctx.fillStyle = wood.end;
  ctx.beginPath();
  ctx.ellipse(-0.46, 0, 0.1, 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = wood.endRing;
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.arc(-0.46, 0, 0.06, 0, Math.PI * 2);
  ctx.stroke();
  if (forest.logMoss) {
    ctx.fillStyle = '#4a9a4a50';
    ctx.beginPath();
    ctx.ellipse(0.1, -0.12, 0.06, 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawStump(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  const v = prop.variation;
  const wood = forest.stump;
  ctx.fillStyle = '#0a1a0a50';
  ctx.beginPath();
  ctx.ellipse(0.03, 0.06, 0.28, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = wood.bark;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.26, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = wood.top;
  ctx.beginPath();
  ctx.ellipse(0, -0.02, 0.22, 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = wood.ring;
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.arc(0, -0.02, 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -0.02, 0.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = wood.crack;
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.moveTo(-0.08, -0.12);
  ctx.lineTo(0.06, 0.1);
  ctx.stroke();
  if (forest.stumpMoss && v > 0.5) {
    ctx.fillStyle = wood.moss;
    ctx.beginPath();
    ctx.ellipse(0.08, -0.08, 0.04, 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFlower(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  const v = prop.variation;
  const petals = forest.flowerPetals;
  const color = petals[Math.floor(v * petals.length)] ?? petals[0];
  const stems = 2 + Math.floor(v * 3);
  for (let i = 0; i < stems; i++) {
    const dx = (i - stems / 2) * 0.1 + (v - 0.5) * 0.06;
    const dy = (i % 2) * 0.06;
    ctx.strokeStyle = forest.flowerStems;
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(dx, dy + 0.1);
    ctx.quadraticCurveTo(dx + 0.02, dy, dx, dy - 0.05);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(dx, dy - 0.06, 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = forest.flowerCenters;
    ctx.beginPath();
    ctx.arc(dx, dy - 0.06, 0.015, 0, Math.PI * 2);
    ctx.fill();
  }
}
