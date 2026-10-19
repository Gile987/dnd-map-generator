import type { ForestCharacter, Prop, PropKind } from '../engine/model';

export type DrawingContext = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineCap'
  | 'lineJoin'
  | 'globalAlpha'
  | 'fillRect'
  | 'strokeRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'fill'
  | 'stroke'
  | 'arc'
  | 'ellipse'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'setTransform'
  | 'createRadialGradient'
  | 'createLinearGradient'
  | 'quadraticCurveTo'
>;

export function path(
  ctx: DrawingContext,
  points: readonly (readonly [number, number])[],
  fill: string,
  stroke?: string,
): void {
  const first = points[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export type TreeVariant = 'oak' | 'pine' | 'broad' | 'fey';

export interface TreeTheme {
  readonly variant: TreeVariant;
  readonly trunk: string;
  readonly canopyDark: string;
  readonly canopyMid: string;
  readonly canopyLight: string;
  readonly sheen: string;
  readonly chipA: string;
  readonly chipB: string;
  readonly pineBase: number;
  readonly pineStep: number;
  readonly pineGreen: number;
}

export interface LogColors {
  readonly base: string;
  readonly grain: string;
  readonly edge: string;
  readonly rings: string;
  readonly end: string;
  readonly endRing: string;
}

export interface StumpColors {
  readonly bark: string;
  readonly top: string;
  readonly ring: string;
  readonly crack: string;
  readonly moss: string;
}

export interface ForestPalette {
  readonly trees: (variation: number) => TreeTheme;
  readonly boulderMoss: boolean;
  readonly logMoss: boolean;
  readonly stumpMoss: boolean;
  readonly log: LogColors;
  readonly stump: StumpColors;
  readonly mushroomStem: string;
  readonly mushroomCaps: readonly [string, string, string];
  readonly mushroomGlow: string | null;
  readonly bushClumps: readonly [string, string];
  readonly bushSheen: string;
  readonly bushChips: string;
  readonly fernStems: readonly [string, string];
  readonly fernLeaves: string;
  readonly flowerStems: string;
  readonly flowerPetals: readonly [string, ...string[]];
  readonly flowerCenters: string;
}

const VerdantOak: TreeTheme = {
  variant: 'oak',
  trunk: '#3a2a18',
  canopyDark: '#2a5a2a',
  canopyMid: '#326832',
  canopyLight: '#3a7a3a',
  sheen: '#4a9a4a50',
  chipA: '#4a8a4a60',
  chipB: '#2a6a2a40',
  pineBase: 35,
  pineStep: 10,
  pineGreen: 45,
};
const VerdantPine: TreeTheme = { ...VerdantOak, variant: 'pine', sheen: '#5aa05a30' };
const VerdantBroad: TreeTheme = {
  variant: 'broad',
  trunk: '#3a2a18',
  canopyDark: '#2e6e2e',
  canopyMid: '#3a8a3a',
  canopyLight: '#3a8a3a',
  sheen: '#5aaa5a40',
  chipA: '#4a9a4a50',
  chipB: '#4a9a4a50',
  pineBase: 35,
  pineStep: 10,
  pineGreen: 45,
};
const AutumnBroad: TreeTheme = {
  variant: 'broad',
  trunk: '#4a3018',
  canopyDark: '#8a521c',
  canopyMid: '#a86e28',
  canopyLight: '#c2903c',
  sheen: '#e0b06050',
  chipA: '#d0984850',
  chipB: '#a8682840',
  pineBase: 30,
  pineStep: 9,
  pineGreen: 38,
};
const AutumnOak: TreeTheme = {
  variant: 'oak',
  trunk: '#4a3018',
  canopyDark: '#7a4a1a',
  canopyMid: '#96642a',
  canopyLight: '#b07c36',
  sheen: '#d0a05050',
  chipA: '#c0884050',
  chipB: '#965c2440',
  pineBase: 30,
  pineStep: 9,
  pineGreen: 38,
};
const AutumnPine: TreeTheme = {
  variant: 'pine',
  trunk: '#4a3018',
  canopyDark: '#3a4a22',
  canopyMid: '#46582a',
  canopyLight: '#546632',
  sheen: '#a0884830',
  chipA: '#8a804040',
  chipB: '#6a603040',
  pineBase: 32,
  pineStep: 9,
  pineGreen: 36,
};
const PineDark: TreeTheme = {
  variant: 'pine',
  trunk: '#3a2e1e',
  canopyDark: '#1e3a26',
  canopyMid: '#264832',
  canopyLight: '#2e563c',
  sheen: '#7ab08830',
  chipA: '#4a8a6030',
  chipB: '#3a705030',
  pineBase: 26,
  pineStep: 8,
  pineGreen: 40,
};
const PineBroad: TreeTheme = {
  variant: 'broad',
  trunk: '#3a2e1e',
  canopyDark: '#24503a',
  canopyMid: '#2e6448',
  canopyLight: '#2e6448',
  sheen: '#7ab08830',
  chipA: '#4a8a6838',
  chipB: '#4a8a6838',
  pineBase: 26,
  pineStep: 8,
  pineGreen: 40,
};
const FeyWhimsy: TreeTheme = {
  variant: 'fey',
  trunk: '#5a4436',
  canopyDark: '#2e7a62',
  canopyMid: '#3a9a78',
  canopyLight: '#58b890',
  sheen: '#b8e8d050',
  chipA: '#8ad8b860',
  chipB: '#5ab89040',
  pineBase: 28,
  pineStep: 9,
  pineGreen: 42,
};
const FeyBroad: TreeTheme = {
  variant: 'broad',
  trunk: '#5a4436',
  canopyDark: '#2e6e52',
  canopyMid: '#3a8a66',
  canopyLight: '#3a8a66',
  sheen: '#8ad8b840',
  chipA: '#68c89850',
  chipB: '#68c89850',
  pineBase: 28,
  pineStep: 9,
  pineGreen: 42,
};
const FeyOak: TreeTheme = {
  variant: 'oak',
  trunk: '#5a4436',
  canopyDark: '#3a7a5a',
  canopyMid: '#4a9a72',
  canopyLight: '#5ab88a',
  sheen: '#a8e8c850',
  chipA: '#78d8a860',
  chipB: '#58b88840',
  pineBase: 28,
  pineStep: 9,
  pineGreen: 42,
};

export function forestTrees(character: ForestCharacter, variation: number): TreeTheme {
  switch (character) {
    case 'Verdant':
      return variation < 0.35 ? VerdantOak : variation < 0.65 ? VerdantPine : VerdantBroad;
    case 'Autumn':
      return variation < 0.7 ? AutumnBroad : variation < 0.85 ? AutumnOak : AutumnPine;
    case 'Pines':
      return variation < 0.9 ? PineDark : PineBroad;
    case 'Fey':
      return variation < 0.6 ? FeyWhimsy : variation < 0.8 ? FeyBroad : FeyOak;
  }
}

export const VERDANT_PALETTE: ForestPalette = {
  trees: (variation) => forestTrees('Verdant', variation),
  boulderMoss: false,
  logMoss: true,
  stumpMoss: true,
  log: {
    base: '#5a4020',
    grain: '#7a5a30',
    edge: '#3a2a15',
    rings: '#8a6a40',
    end: '#6a4a28',
    endRing: '#8a6a40',
  },
  stump: {
    bark: '#5a4020',
    top: '#8a6a40',
    ring: '#aa8a50',
    crack: '#4a3018',
    moss: '#5a9a4a70',
  },
  mushroomStem: '#8a7060',
  mushroomCaps: ['#c85040', '#b87050', '#d09060'],
  mushroomGlow: null,
  bushClumps: ['#3a7a3a', '#2e6e2e'],
  bushSheen: '#5aaa5a40',
  bushChips: '#5aaa4a50',
  fernStems: ['#4a8a3a', '#5a9a4a'],
  fernLeaves: '#5aaa4a80',
  flowerStems: '#4a8a3a',
  flowerPetals: ['#d06080', '#e0a040', '#a060c0', '#e0e060', '#e07070'],
  flowerCenters: '#e0e080',
};

export function drawProp(
  ctx: DrawingContext,
  prop: Prop,
  forest: ForestPalette = VERDANT_PALETTE,
): void {
  ctx.save();
  ctx.translate(
    prop.x + 0.5,
    prop.y + (prop.kind === 'sconce' ? 0.18 : prop.kind === 'tree' ? 0.5 : 0.5),
  );
  ctx.lineWidth = 0.025;
  const v = prop.variation;
  if (prop.kind === 'crate') {
    ctx.rotate((v - 0.5) * 0.18);
    ctx.fillStyle = '#1a282bb0';
    ctx.fillRect(-0.3, -0.25, 0.73, 0.72);
    ctx.fillStyle = '#665337';
    ctx.fillRect(-0.36, -0.37, 0.7, 0.7);
    ctx.fillStyle = '#a28b58';
    ctx.fillRect(-0.32, -0.33, 0.61, 0.08);
    ctx.fillRect(-0.32, -0.33, 0.07, 0.6);
    ctx.strokeStyle = '#352e23';
    ctx.strokeRect(-0.35, -0.36, 0.69, 0.69);
    for (let x = -0.16; x < 0.3; x += 0.15) {
      ctx.beginPath();
      ctx.moveTo(x, -0.24);
      ctx.lineTo(x, 0.27);
      ctx.stroke();
    }
    path(
      ctx,
      [
        [-0.27, 0.2],
        [0.22, -0.29],
        [0.29, -0.21],
        [-0.2, 0.28],
      ],
      '#ab8b57',
      '#463d2c',
    );
    ctx.fillStyle = '#c6b27d';
    for (const [x, y] of [
      [-0.29, -0.29],
      [0.26, -0.29],
      [-0.29, 0.25],
      [0.26, 0.25],
    ] as const)
      ctx.fillRect(x, y, 0.035, 0.035);
  } else if (prop.kind === 'barrel') {
    ctx.fillStyle = '#17282b90';
    ctx.beginPath();
    ctx.ellipse(0.08, 0.14, 0.4, 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    const wood = ctx.createLinearGradient(-0.35, -0.35, 0.35, 0.35);
    wood.addColorStop(0, '#c0a36b');
    wood.addColorStop(0.5, '#92764d');
    wood.addColorStop(1, '#584633');
    ctx.fillStyle = wood;
    ctx.strokeStyle = '#343c39';
    ctx.lineWidth = 0.055;
    ctx.beginPath();
    ctx.arc(0, 0, 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 0.016;
    ctx.strokeStyle = '#57452f';
    for (const x of [-0.18, -0.04, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(x, -0.27);
      ctx.lineTo(x, 0.26);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c3bc94';
    ctx.beginPath();
    ctx.arc(-0.015, -0.015, 0.285, Math.PI, Math.PI * 1.65);
    ctx.stroke();
    ctx.fillStyle = '#463e2d';
    ctx.beginPath();
    ctx.arc(0.08, 0.07, 0.045, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'rubble') {
    const stones = [
      [-0.23, 0.12, 0.24],
      [0.15, 0.17, 0.19],
      [0.03, -0.17, 0.25],
      [-0.26, -0.22, 0.12],
      [0.31, -0.15, 0.1],
    ] as const;
    for (const [x, y, size] of stones) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(v * 3 + x);
      path(
        ctx,
        [
          [-size, -size * 0.5],
          [0, -size],
          [size, -size * 0.25],
          [size * 0.8, size],
          [-size * 0.7, size * 0.8],
        ],
        '#293c4190',
      );
      ctx.translate(-0.04, -0.06);
      path(
        ctx,
        [
          [-size, -size * 0.5],
          [0, -size],
          [size, -size * 0.25],
          [size * 0.8, size],
          [-size * 0.7, size * 0.8],
        ],
        '#718284',
        '#3c5057',
      );
      ctx.strokeStyle = '#adbbb1';
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.5);
      ctx.lineTo(0, -size);
      ctx.lineTo(size, -size * 0.25);
      ctx.stroke();
      ctx.restore();
    }
  } else if (prop.kind === 'rug') {
    ctx.fillStyle = '#24343870';
    ctx.fillRect(-0.86, -1.05, 1.85, 2.3);
    ctx.fillStyle = '#75485a';
    ctx.fillRect(-0.9, -1.1, 1.8, 2.2);
    ctx.strokeStyle = '#c19b73';
    ctx.lineWidth = 0.035;
    ctx.strokeRect(-0.77, -0.97, 1.54, 1.94);
    ctx.strokeStyle = '#a8756d';
    ctx.lineWidth = 0.025;
    ctx.strokeRect(-0.66, -0.86, 1.32, 1.72);
    path(
      ctx,
      [
        [0, -0.64],
        [0.45, 0],
        [0, 0.64],
        [-0.45, 0],
      ],
      '#996571',
      '#c3a07a',
    );
    path(
      ctx,
      [
        [0, -0.25],
        [0.18, 0],
        [0, 0.25],
        [-0.18, 0],
      ],
      '#c0a67e',
    );
    ctx.strokeStyle = '#ad9174';
    for (let x = -0.8; x < 0.9; x += 0.12) {
      ctx.beginPath();
      ctx.moveTo(x, -1.1);
      ctx.lineTo(x - 0.03, -1.2);
      ctx.moveTo(x, 1.1);
      ctx.lineTo(x + 0.02, 1.2);
      ctx.stroke();
    }
  } else if (prop.kind === 'moss') {
    for (let i = 0; i < 9; i++) {
      const x = Math.sin(i * 11 + v * 24) * 0.38;
      const y = Math.cos(i * 4 + v * 31) * 0.3;
      ctx.fillStyle = i % 2 ? '#487f6990' : '#7ba38980';
      ctx.beginPath();
      ctx.ellipse(x, y, 0.12 + (i % 3) * 0.025, 0.055, i, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2d655e';
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.08, y - 0.1);
      ctx.stroke();
    }
  } else if (prop.kind === 'sarcophagus') {
    ctx.rotate((v - 0.5) * 0.12);
    ctx.fillStyle = '#1a282bb0';
    ctx.fillRect(-0.42, -0.22, 0.88, 0.62);
    ctx.fillStyle = '#5a6870';
    ctx.fillRect(-0.46, -0.28, 0.88, 0.62);
    ctx.fillStyle = '#7d8e8a';
    ctx.fillRect(-0.42, -0.24, 0.8, 0.54);
    ctx.strokeStyle = '#3c4e52';
    ctx.lineWidth = 0.03;
    ctx.strokeRect(-0.46, -0.28, 0.88, 0.62);
    ctx.fillStyle = '#6a7b78';
    ctx.fillRect(-0.34, -0.18, 0.64, 0.06);
    ctx.fillRect(-0.34, 0.18, 0.64, 0.06);
    ctx.strokeStyle = '#99aba3';
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.moveTo(-0.15, -0.12);
    ctx.lineTo(-0.15, 0.18);
    ctx.moveTo(0.12, -0.12);
    ctx.lineTo(0.12, 0.18);
    ctx.stroke();
    path(
      ctx,
      [
        [-0.06, -0.06],
        [0.03, -0.12],
        [0.06, -0.03],
        [0.03, 0.02],
        [-0.03, 0.02],
        [-0.06, -0.03],
      ],
      '#8a9e96',
      '#5a706a',
    );
  } else if (prop.kind === 'vine') {
    for (let i = 0; i < 5; i++) {
      const startX = (v - 0.5) * 0.3 + (i - 2) * 0.12;
      const startY = -0.42;
      ctx.strokeStyle = i % 2 ? '#3a7a5a' : '#4a8e68';
      ctx.lineWidth = 0.025 + (i % 3) * 0.008;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      const segments = 3 + (i % 2);
      let cx = startX;
      let cy = startY;
      for (let s = 0; s < segments; s++) {
        cx += Math.sin(i * 7 + s * 3 + v * 10) * 0.1;
        cy += 0.18 + v * 0.06;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      for (let s = 0; s < segments; s++) {
        const lx = startX + Math.sin(i * 7 + s * 3 + v * 10) * 0.1 * (s + 1);
        const ly = startY + (0.18 + v * 0.06) * (s + 1);
        if ((i + s) % 2 === 0) {
          ctx.fillStyle = '#5a9e72a0';
          ctx.beginPath();
          ctx.ellipse(lx + 0.04, ly, 0.04, 0.025, i + s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (prop.kind === 'broken_column') {
    ctx.rotate((v - 0.5) * 0.15);
    ctx.fillStyle = '#1a282b80';
    ctx.beginPath();
    ctx.arc(0.04, 0.08, 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b7d7a';
    ctx.beginPath();
    ctx.arc(0, 0, 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3e524e';
    ctx.lineWidth = 0.04;
    ctx.stroke();
    ctx.fillStyle = '#8a9e97';
    ctx.beginPath();
    ctx.arc(-0.02, -0.02, 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b0c0b4';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.arc(-0.04, -0.04, 0.22, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
    const cracks = [
      [-0.15, -0.2, 0.05, 0.15],
      [0.1, -0.08, -0.12, 0.22],
    ] as const;
    ctx.strokeStyle = '#4a5e58';
    ctx.lineWidth = 0.018;
    for (const [x1, y1, x2, y2] of cracks) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.fillStyle = '#52645e';
    ctx.beginPath();
    ctx.moveTo(0.15, -0.3);
    ctx.lineTo(0.32, -0.18);
    ctx.lineTo(0.28, -0.05);
    ctx.lineTo(0.18, -0.1);
    ctx.closePath();
    ctx.fill();
  } else if (prop.kind === 'tree') {
    drawTree(ctx, prop, forest.trees(prop.variation));
  } else if (prop.kind === 'boulder') {
    drawBoulder(ctx, prop, forest.boulderMoss);
  } else if (prop.kind === 'fern') {
    drawFern(ctx, prop, forest);
  } else if (prop.kind === 'mushroom') {
    drawMushroom(ctx, prop, forest);
  } else if (prop.kind === 'bush') {
    drawBush(ctx, prop, forest);
  } else if (prop.kind === 'log') {
    drawLog(ctx, prop, forest);
  } else if (prop.kind === 'stump') {
    drawStump(ctx, prop, forest);
  } else if (prop.kind === 'flower') {
    drawFlower(ctx, prop, forest);
  } else {
    ctx.fillStyle = '#26373b';
    ctx.fillRect(-0.11, -0.14, 0.23, 0.36);
    ctx.fillStyle = '#ac9360';
    ctx.fillRect(-0.16, -0.14, 0.32, 0.21);
    path(
      ctx,
      [
        [-0.1, -0.07],
        [-0.06, -0.35],
        [0.03, -0.48],
        [0.1, -0.2],
        [0.09, -0.07],
      ],
      '#f1bd73',
    );
    path(
      ctx,
      [
        [-0.04, -0.08],
        [0, -0.28],
        [0.05, -0.08],
      ],
      '#fff0bf',
    );
  }
  ctx.restore();
}

function drawTree(ctx: DrawingContext, prop: Prop, theme: TreeTheme): void {
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

function drawBoulder(ctx: DrawingContext, prop: Prop, moss: boolean): void {
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

function drawFern(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
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

function drawMushroom(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
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

function drawBush(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
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

function drawLog(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
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

function drawStump(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
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

function drawFlower(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
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
