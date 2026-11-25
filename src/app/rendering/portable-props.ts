import type { CourtyardCharacter, DecorationPreset, Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import type { ForestPalette } from './forest-palette';

export interface PortablePropPalette {
  readonly wood: string;
  readonly darkWood: string;
  readonly grain: string;
  readonly metal: string;
  readonly metalLight: string;
  readonly cloth: string;
  readonly darkCloth: string;
  readonly rope: string;
}

const weathered: PortablePropPalette = {
  wood: '#8c663f',
  darkWood: '#493727',
  grain: '#bd9664',
  metal: '#575b53',
  metalLight: '#b7bba6',
  cloth: '#b2a178',
  darkCloth: '#776b4e',
  rope: '#d5c194',
};

export const DUNGEON_PORTABLE_PALETTES: Readonly<Record<DecorationPreset, PortablePropPalette>> = {
  Mosslit: weathered,
  Crypt: {
    ...weathered,
    wood: '#746856',
    darkWood: '#393832',
    grain: '#a99a7a',
    cloth: '#a5a08c',
    darkCloth: '#666b5e',
  },
  Storehouse: {
    ...weathered,
    wood: '#a17142',
    darkWood: '#513728',
    grain: '#d4a86c',
    cloth: '#c4ae78',
    darkCloth: '#897046',
  },
  Sanctuary: {
    ...weathered,
    wood: '#777b50',
    darkWood: '#384537',
    grain: '#b0b180',
    metal: '#5b6c58',
    cloth: '#9fbc8b',
    darkCloth: '#607653',
  },
};

/** Use the accepted map's existing wood palette; no artwork data enters saves. */
export function portablePropPalette(
  forest: ForestPalette,
  courtyard: CourtyardCharacter,
): PortablePropPalette {
  const base = {
    ...weathered,
    wood: forest.log.grain,
    darkWood: forest.log.edge,
    grain: forest.log.rings,
    cloth: forest.stump.top,
    darkCloth: forest.stump.bark,
  };
  switch (courtyard) {
    case 'Overgrown':
      return base;
    case 'Sunbleached':
      return {
        ...base,
        wood: '#ac8b58',
        darkWood: '#6a5034',
        grain: '#dbc18a',
        cloth: '#d2bd83',
        darkCloth: '#98804f',
      };
    case 'Frostbound':
      return {
        ...base,
        wood: '#7c8585',
        darkWood: '#414e55',
        grain: '#bac4b9',
        metal: '#657880',
        metalLight: '#d2e0df',
        cloth: '#aebfbe',
        darkCloth: '#6c8489',
      };
    case 'Desecrated':
      return {
        ...base,
        wood: '#756050',
        darkWood: '#3f3038',
        grain: '#ac8b6d',
        metal: '#795945',
        metalLight: '#c09a75',
        cloth: '#a38c8a',
        darkCloth: '#65505f',
      };
  }
}

export function drawTreasureChest(
  ctx: DrawingContext,
  prop: Prop,
  colors: PortablePropPalette,
): void {
  ctx.rotate((prop.variation - 0.5) * 0.12);
  ctx.fillStyle = '#15211e70';
  ctx.fillRect(-0.39, -0.24, 0.83, 0.6);
  ctx.fillStyle = colors.darkWood;
  ctx.fillRect(-0.4, -0.28, 0.8, 0.57);
  const lid = ctx.createLinearGradient(0, -0.33, 0, 0.18);
  lid.addColorStop(0, colors.darkWood);
  lid.addColorStop(0.35, colors.grain);
  lid.addColorStop(0.8, colors.wood);
  lid.addColorStop(1, colors.darkWood);
  ctx.fillStyle = lid;
  ctx.beginPath();
  ctx.moveTo(-0.4, 0.12);
  ctx.lineTo(-0.4, -0.21);
  ctx.quadraticCurveTo(-0.4, -0.34, -0.27, -0.34);
  ctx.lineTo(0.27, -0.34);
  ctx.quadraticCurveTo(0.4, -0.34, 0.4, -0.21);
  ctx.lineTo(0.4, 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = colors.darkWood;
  ctx.lineWidth = 0.012;
  for (const x of [-0.13, 0.13]) {
    ctx.beginPath();
    ctx.moveTo(x, -0.32);
    ctx.lineTo(x, 0.11);
    ctx.stroke();
  }
  ctx.fillStyle = colors.metal;
  for (const x of [-0.3, 0.23]) {
    ctx.fillRect(x, -0.31, 0.07, 0.58);
    ctx.fillStyle = colors.metalLight;
    ctx.fillRect(x + 0.012, -0.29, 0.012, 0.53);
    ctx.fillStyle = colors.metal;
  }
  ctx.fillRect(-0.4, 0.11, 0.8, 0.045);
  ctx.fillStyle = colors.metalLight;
  ctx.fillRect(-0.07, 0.08, 0.14, 0.14);
  ctx.fillStyle = colors.darkWood;
  ctx.beginPath();
  ctx.arc(0, 0.13, 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-0.009, 0.13, 0.018, 0.055);
  ctx.strokeStyle = colors.darkWood;
  ctx.lineWidth = 0.025;
  ctx.strokeRect(-0.4, -0.28, 0.8, 0.57);
}

export function drawSupplySacks(
  ctx: DrawingContext,
  prop: Prop,
  colors: PortablePropPalette,
): void {
  ctx.rotate((prop.variation - 0.5) * 0.16);
  for (const [x, y, width, height, turn] of [
    [-0.19, -0.12, 0.2, 0.28, -0.18],
    [0.2, -0.09, 0.19, 0.27, 0.22],
    [0.02, 0.21, 0.23, 0.2, -0.08],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    ctx.fillStyle = '#14221e65';
    ctx.beginPath();
    ctx.ellipse(0.025, 0.035, width, height, 0, 0, Math.PI * 2);
    ctx.fill();
    const cloth = ctx.createLinearGradient(-width, 0, width, 0);
    cloth.addColorStop(0, colors.darkCloth);
    cloth.addColorStop(0.4, colors.cloth);
    cloth.addColorStop(1, colors.darkCloth);
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.darkWood;
    ctx.lineWidth = 0.018;
    ctx.stroke();
    ctx.strokeStyle = colors.rope;
    ctx.lineWidth = 0.013;
    ctx.beginPath();
    ctx.moveTo(-width * 0.65, -height * 0.5);
    ctx.quadraticCurveTo(-width * 0.75, height * 0.5, 0, height * 0.85);
    ctx.stroke();
    ctx.fillStyle = colors.darkCloth;
    ctx.beginPath();
    ctx.ellipse(0, -height * 0.58, width * 0.3, 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.rope;
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(-0.055, -height * 0.58);
    ctx.lineTo(0.055, -height * 0.58);
    ctx.moveTo(0, -height * 0.58);
    ctx.lineTo(0.07, -height * 0.3);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawWeaponRack(ctx: DrawingContext, prop: Prop, colors: PortablePropPalette): void {
  ctx.rotate((prop.variation - 0.5) * 0.1);
  ctx.fillStyle = '#14211e70';
  ctx.fillRect(-0.36, -0.33, 0.78, 0.75);
  ctx.fillStyle = colors.darkWood;
  for (const x of [-0.34, 0.27]) ctx.fillRect(x, -0.37, 0.07, 0.74);
  ctx.fillRect(-0.39, -0.29, 0.78, 0.08);
  ctx.fillRect(-0.39, 0.19, 0.78, 0.09);
  ctx.fillStyle = colors.wood;
  ctx.fillRect(-0.37, -0.28, 0.74, 0.035);
  ctx.fillRect(-0.37, 0.2, 0.74, 0.035);
  for (const [x, turn] of [
    [-0.2, -0.06],
    [0, 0.03],
    [0.2, -0.02],
  ] as const) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(turn);
    ctx.fillStyle = colors.metal;
    ctx.beginPath();
    ctx.moveTo(0, -0.41);
    ctx.lineTo(0.045, -0.31);
    ctx.lineTo(0.035, 0.1);
    ctx.lineTo(-0.035, 0.1);
    ctx.lineTo(-0.045, -0.31);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colors.metalLight;
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.moveTo(0, -0.35);
    ctx.lineTo(0, 0.08);
    ctx.stroke();
    ctx.fillStyle = colors.grain;
    ctx.fillRect(-0.09, 0.09, 0.18, 0.035);
    ctx.fillStyle = colors.darkCloth;
    ctx.fillRect(-0.025, 0.125, 0.05, 0.18);
    ctx.strokeStyle = colors.rope;
    ctx.lineWidth = 0.012;
    for (const y of [0.16, 0.21, 0.26]) {
      ctx.beginPath();
      ctx.moveTo(-0.025, y);
      ctx.lineTo(0.025, y - 0.02);
      ctx.stroke();
    }
    ctx.fillStyle = colors.metal;
    ctx.beginPath();
    ctx.arc(0, 0.32, 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Backless wooden bench, entirely inside its two-square footprint. */
export function drawWoodenBench(
  ctx: DrawingContext,
  prop: Prop,
  colors: PortablePropPalette,
): void {
  ctx.fillStyle = '#15211e70';
  ctx.fillRect(-0.91, -0.27, 1.86, 0.65);
  ctx.fillStyle = colors.darkWood;
  for (const x of [-0.77, 0.67]) ctx.fillRect(x, -0.34, 0.1, 0.7);
  for (const y of [-0.27, -0.09, 0.09]) {
    ctx.fillStyle = colors.darkWood;
    ctx.fillRect(-0.91, y, 1.82, 0.16);
    ctx.fillStyle = colors.wood;
    ctx.fillRect(-0.88, y + 0.015, 1.76, 0.125);
    ctx.strokeStyle = colors.grain;
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(-0.83, y + 0.055);
    ctx.lineTo(0.82, y + 0.055 + (prop.variation - 0.5) * 0.025);
    ctx.stroke();
  }
  ctx.fillStyle = colors.metal;
  for (const x of [-0.72, 0.72])
    for (const y of [-0.2, 0.16]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
}

/** A framed bed with pillow and folded blanket, inside a two-square footprint. */
export function drawWoodenBed(ctx: DrawingContext, prop: Prop, colors: PortablePropPalette): void {
  ctx.fillStyle = '#15211e70';
  ctx.fillRect(-0.96, -0.43, 1.92, 0.88);
  ctx.fillStyle = colors.darkWood;
  ctx.fillRect(-0.9, -0.4, 1.8, 0.8);
  ctx.fillStyle = '#c4c0a9';
  ctx.fillRect(-0.76, -0.32, 1.52, 0.64);
  ctx.fillStyle = colors.cloth;
  ctx.fillRect(-0.13, -0.32, 0.9, 0.64);
  ctx.fillStyle = colors.darkCloth;
  ctx.fillRect(-0.13, -0.32, 0.12, 0.64);
  ctx.strokeStyle = '#ffffff35';
  ctx.lineWidth = 0.015;
  ctx.strokeRect(0.02, -0.27, 0.69, 0.54);
  ctx.strokeStyle = colors.darkCloth;
  ctx.beginPath();
  ctx.moveTo(0.13, -0.2);
  ctx.quadraticCurveTo(0.42, 0.02 + (prop.variation - 0.5) * 0.04, 0.68, 0.19);
  ctx.stroke();
  ctx.fillStyle = '#8f9487';
  ctx.fillRect(-0.71, -0.24, 0.48, 0.5);
  ctx.fillStyle = '#e8e3d0';
  ctx.beginPath();
  ctx.moveTo(-0.68, -0.25);
  ctx.quadraticCurveTo(-0.73, 0, -0.68, 0.24);
  ctx.lineTo(-0.27, 0.24);
  ctx.quadraticCurveTo(-0.22, 0, -0.27, -0.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b1b4a3';
  ctx.lineWidth = 0.012;
  ctx.stroke();
  for (const x of [-0.95, 0.82]) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(x, -0.43, 0.12, 0.86);
    ctx.fillStyle = colors.grain;
    ctx.fillRect(x + 0.015, -0.41, 0.02, 0.82);
    ctx.fillStyle = colors.darkWood;
    ctx.fillRect(x - 0.01, -0.46, 0.14, 0.1);
    ctx.fillRect(x - 0.01, 0.36, 0.14, 0.1);
  }
}

/** A square plank table with corner legs, entirely inside one occupied square. */
export function drawSmallTable(ctx: DrawingContext, prop: Prop, colors: PortablePropPalette): void {
  ctx.fillStyle = '#15211e70';
  ctx.fillRect(-0.4, -0.37, 0.85, 0.82);
  ctx.fillStyle = colors.darkWood;
  for (const x of [-0.41, 0.29]) for (const y of [-0.41, 0.29]) ctx.fillRect(x, y, 0.12, 0.12);
  ctx.fillRect(-0.4, -0.39, 0.8, 0.79);
  for (const y of [-0.36, -0.12, 0.12]) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(-0.37, y, 0.74, 0.22);
    ctx.strokeStyle = colors.grain;
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(-0.33, y + 0.07);
    ctx.quadraticCurveTo(0, y + 0.1 + (prop.variation - 0.5) * 0.04, 0.32, y + 0.07);
    ctx.stroke();
  }
  ctx.fillStyle = colors.metal;
  for (const x of [-0.31, 0.31])
    for (const y of [-0.29, 0.29]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.strokeStyle = colors.darkWood;
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.ellipse(0.16, -0.01, 0.05, 0.022, 0.1, 0, Math.PI * 2);
  ctx.stroke();
}
