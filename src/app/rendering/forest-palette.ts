import type { ForestCharacter } from '../engine/model';

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

function forestTrees(character: ForestCharacter, variation: number): TreeTheme {
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

const AUTUMN_PALETTE: ForestPalette = {
  trees: (variation) => forestTrees('Autumn', variation),
  boulderMoss: false,
  logMoss: false,
  stumpMoss: false,
  log: {
    base: '#4e4434',
    grain: '#6a5c48',
    edge: '#2e2820',
    rings: '#7a6c54',
    end: '#5a4e3c',
    endRing: '#7a6c54',
  },
  stump: {
    bark: '#4e4434',
    top: '#7a6c50',
    ring: '#9a8c66',
    crack: '#383024',
    moss: '#8a9a4a60',
  },
  mushroomStem: '#8a7860',
  mushroomCaps: ['#c85040', '#b87050', '#d09060'],
  mushroomGlow: null,
  bushClumps: ['#a8742e', '#8a5a24'],
  bushSheen: '#c8985840',
  bushChips: '#c8905050',
  fernStems: ['#8a7a34', '#9a8a3e'],
  fernLeaves: '#b0a04080',
  flowerStems: '#8a7a3a',
  flowerPetals: ['#d06080', '#e0a040', '#c07840', '#e0d060', '#d08858'],
  flowerCenters: '#e8e090',
};

const PINES_PALETTE: ForestPalette = {
  trees: (variation) => forestTrees('Pines', variation),
  boulderMoss: true,
  logMoss: false,
  stumpMoss: false,
  log: {
    base: '#4a4038',
    grain: '#625648',
    edge: '#28221e',
    rings: '#72655a',
    end: '#544a40',
    endRing: '#72655a',
  },
  stump: {
    bark: '#4a4034',
    top: '#74644a',
    ring: '#948466',
    crack: '#332c22',
    moss: '#4a7a4a60',
  },
  mushroomStem: '#7a6e60',
  mushroomCaps: ['#a86848', '#986048', '#b88858'],
  mushroomGlow: null,
  bushClumps: ['#2e5e3e', '#265036'],
  bushSheen: '#5a9a7040',
  bushChips: '#5a9a7050',
  fernStems: ['#3a6a34', '#46763e'],
  fernLeaves: '#569a4e80',
  flowerStems: '#4a6a44',
  flowerPetals: ['#c8b890', '#b8a880', '#d0c0a0', '#a89878', '#c0b090'],
  flowerCenters: '#e0d8b0',
};

const FEY_PALETTE: ForestPalette = {
  trees: (variation) => forestTrees('Fey', variation),
  boulderMoss: true,
  logMoss: false,
  stumpMoss: true,
  log: {
    base: '#4e4a3a',
    grain: '#6a6450',
    edge: '#2c2a20',
    rings: '#7e7860',
    end: '#5a5444',
    endRing: '#7e7860',
  },
  stump: {
    bark: '#4e4a3a',
    top: '#7a7458',
    ring: '#9a9470',
    crack: '#363226',
    moss: '#5ab89070',
  },
  mushroomStem: '#7a8a80',
  mushroomCaps: ['#8ad8c0', '#c8a0e8', '#e8d890'],
  mushroomGlow: '#b8e8d840',
  bushClumps: ['#3a8a6a', '#2e7a62'],
  bushSheen: '#68c8a850',
  bushChips: '#68c8a850',
  fernStems: ['#3a9a6a', '#4aad7a'],
  fernLeaves: '#68c89880',
  flowerStems: '#4a9a6a',
  flowerPetals: ['#e8d890', '#c8a0e8', '#8ad8c0', '#f0f0c0', '#e8a8d0'],
  flowerCenters: '#f8f8c0',
};

export const FOREST_PALETTES: Readonly<Record<ForestCharacter, ForestPalette>> = {
  Verdant: VERDANT_PALETTE,
  Autumn: AUTUMN_PALETTE,
  Pines: PINES_PALETTE,
  Fey: FEY_PALETTE,
};
