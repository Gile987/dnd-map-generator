export { TOWER_STAIR_LABELS } from '../engine/tower';
import type {
  CourtyardCharacter,
  DecorationPreset,
  Density,
  ForestCharacter,
  MapType,
} from '../engine/model';
import type { IconName } from '../icon';

export const MAP_TYPE_LABELS: Readonly<Record<MapType, string>> = {
  tower: 'Tower',
  dungeon: 'Dungeon',
  forest: 'Forest',
  courtyard: 'Courtyard',
};
export const MAP_TYPE_ICONS: Readonly<Record<MapType, IconName>> = {
  tower: 'layers',
  dungeon: 'layers',
  forest: 'tree',
  courtyard: 'ruin',
};
export const MAP_HEADINGS: Readonly<Record<MapType, string>> = {
  tower: 'Raise your tower',
  dungeon: 'Shape your dungeon',
  forest: 'Shape your clearing',
  courtyard: 'Shape your courtyard',
};
export const PRESET_DESCRIPTIONS: Readonly<Record<DecorationPreset, string>> = {
  Mosslit: 'Cool slate. Soft moss. A warm glow.',
  Crypt: 'Stone sarcophagi and subdued lantern light.',
  Storehouse: 'Crates, barrels, and worn runners.',
  Sanctuary: 'Moss, vines, and broken architecture.',
};

export const PRESET_LABELS: Readonly<Record<DecorationPreset, string>> = {
  Mosslit: 'Mosslit stone',
  Crypt: 'Ancient crypt',
  Storehouse: 'Abandoned storehouse',
  Sanctuary: 'Overgrown sanctuary',
};

export const CHARACTER_DESCRIPTIONS: Readonly<Record<ForestCharacter, string>> = {
  Verdant: 'Lush broadleaf woodland with ferns and mossy logs.',
  Autumn: 'Gold and russet canopies over fallen leaves.',
  Pines: 'Ancient evergreens on a needle-covered floor.',
  Fey: 'Unusual trees, flowering moss, and faint glimmers.',
};

export const CHARACTER_LABELS: Readonly<Record<ForestCharacter, string>> = {
  Verdant: 'Verdant woodland',
  Autumn: 'Autumn grove',
  Pines: 'Ancient pines',
  Fey: 'Fey glade',
};

export const COURTYARD_CHARACTER_DESCRIPTIONS: Readonly<Record<CourtyardCharacter, string>> = {
  Overgrown: 'Weathered paving, broken walls, and open grass approaches.',
  Sunbleached: 'Sun-cracked paving, dry grass, and loose stony rubble.',
  Frostbound: 'Frosted paving, pale cold ground, and snow-flecked stone.',
  Desecrated: 'Ashen ground, darkened stone, and creeping dead vines.',
};

export const COURTYARD_CHARACTER_LABELS: Readonly<Record<CourtyardCharacter, string>> = {
  Overgrown: 'Overgrown ruin',
  Sunbleached: 'Sunbleached ruin',
  Frostbound: 'Frostbound ruin',
  Desecrated: 'Desecrated ruin',
};

export const DENSITY_DESCRIPTIONS: Readonly<Record<Density, string>> = {
  Sparse: 'Quiet spaces, room to imagine.',
  Balanced: 'A little character. Plenty of space.',
  Cluttered: 'Storied spaces, with paths kept clear.',
};
