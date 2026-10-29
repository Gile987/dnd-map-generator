import type { GeneratedMap } from '../engine/model';
import { LANDMARK_CATALOG } from '../engine/landmark-catalog';
import { CHARACTER_LABELS, PRESET_LABELS, TOWER_STAIR_LABELS } from './presentation';
import {
  towerDraftForMap,
  courtyardDraftForMap,
  dungeonDraftForMap,
  forestDraftForMap,
} from './settings-draft';
import type { SettingsDraft } from './settings-draft';

export interface PendingChange {
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

function additionNames(draft: SettingsDraft): string {
  if (draft.type === 'tower')
    return /^\d+$/.test(draft.laboratoryFloor) && draft.laboratoryFloor !== 'none'
      ? 'Alchemist’s laboratory'
      : 'None';
  if (draft.type === 'courtyard') return draft.fountain ? 'Dry fountain' : 'None';
  const names: string[] = [];
  if (draft.scene && draft.scene !== 'None') names.push(draft.scene);
  if (draft.landmark && draft.landmark !== 'None')
    names.push(LANDMARK_CATALOG[draft.landmark].label);
  if (draft.type === 'dungeon' && draft.furniture === 'dining-table') names.push('Dining table');
  if (draft.type === 'dungeon' && draft.ritual) names.push('Ritual site');
  return names.join(', ') || 'None';
}

export function pendingSettingChanges(
  map: GeneratedMap,
  draft: SettingsDraft,
): readonly PendingChange[] {
  const accepted =
    map.type === 'tower'
      ? towerDraftForMap(map)
      : map.type === 'dungeon'
        ? dungeonDraftForMap(map)
        : map.type === 'forest'
          ? forestDraftForMap(map)
          : courtyardDraftForMap(map);
  if (accepted.type !== draft.type) return [];
  const changes: PendingChange[] = [];
  const add = (label: string, before: string, after: string) => {
    if (before !== after) changes.push({ label, before, after: after || 'Not set' });
  };
  add('World seed', accepted.seed, draft.seed.trim());
  if (accepted.type === 'tower' && draft.type === 'tower') {
    add(
      'Staircase style',
      TOWER_STAIR_LABELS[accepted.stairStyle ?? 'spiral'],
      TOWER_STAIR_LABELS[draft.stairStyle ?? 'spiral'],
    );
    add(
      'Floors',
      accepted.floors,
      /^\d+$/.test(draft.floors) ? String(Number(draft.floors)) : draft.floors,
    );
    add(
      'Secret portal',
      accepted.portalFloor === 'none' ? 'None' : `Floor ${accepted.portalFloor} → Secret floor`,
      draft.portalFloor === 'none' ? 'None' : `Floor ${draft.portalFloor} → Secret floor`,
    );
    add(
      'Laboratory floor',
      accepted.laboratoryFloor === 'none' ? 'None' : `Floor ${accepted.laboratoryFloor}`,
      draft.laboratoryFloor === 'none' ? 'None' : `Floor ${draft.laboratoryFloor}`,
    );
  }
  if (accepted.type === 'dungeon' && draft.type === 'dungeon') {
    // Valid padded integers mean the same room count; preserve invalid raw input.
    const rooms = /^\d+$/.test(draft.rooms)
      ? String(Number(draft.rooms))
      : draft.rooms.trim() === draft.rooms
        ? draft.rooms
        : JSON.stringify(draft.rooms);
    add('Rooms', accepted.rooms, rooms);
    add('Character', PRESET_LABELS[accepted.preset], PRESET_LABELS[draft.preset]);
  } else if (accepted.type === 'forest' && draft.type === 'forest') {
    add('Character', CHARACTER_LABELS[accepted.character], CHARACTER_LABELS[draft.character]);
  }
  add('Additions', additionNames(accepted), additionNames(draft));
  add('Decoration', accepted.density, draft.density);
  return changes;
}
