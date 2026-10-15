import type { Prop } from '../engine/model';

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

export function drawProp(ctx: DrawingContext, prop: Prop): void {
  ctx.save();
  ctx.translate(prop.x + 0.5, prop.y + (prop.kind === 'sconce' ? 0.18 : 0.5));
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
