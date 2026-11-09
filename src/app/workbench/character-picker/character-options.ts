import { ALL_COURTYARD_CHARACTERS, ALL_PRESETS, ALL_FOREST_CHARACTERS } from '../../engine/model';
import type { CharacterSample } from '../../rendering/character-sample';
import {
  CHARACTER_DESCRIPTIONS,
  CHARACTER_LABELS,
  COURTYARD_CHARACTER_DESCRIPTIONS,
  COURTYARD_CHARACTER_LABELS,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
} from '../presentation';

export type CharacterOption = CharacterSample & {
  readonly label: string;
  readonly description: string;
};

export const CHARACTER_OPTIONS: Readonly<
  Record<'dungeon' | 'forest' | 'courtyard', readonly CharacterOption[]>
> = {
  dungeon: ALL_PRESETS.map((id) => ({
    type: 'dungeon',
    id,
    label: PRESET_LABELS[id],
    description: PRESET_DESCRIPTIONS[id],
  })),
  forest: ALL_FOREST_CHARACTERS.map((id) => ({
    type: 'forest',
    id,
    label: CHARACTER_LABELS[id],
    description: CHARACTER_DESCRIPTIONS[id],
  })),
  courtyard: ALL_COURTYARD_CHARACTERS.map((id) => ({
    type: 'courtyard',
    id,
    label: COURTYARD_CHARACTER_LABELS[id],
    description: COURTYARD_CHARACTER_DESCRIPTIONS[id],
  })),
};
