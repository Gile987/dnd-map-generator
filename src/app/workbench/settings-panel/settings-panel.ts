import { TOWER_STAIR_STYLES } from '../../engine/tower';
import { LANDMARK_CATALOG, landmarkIdsFor } from '../../engine/landmark-catalog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ALL_DENSITIES, ROOM_MAX, ROOM_MIN } from '../../engine/model';
import type { GeneratedMap, MapType } from '../../engine/model';
import { Icon } from '../../icon';
import {
  CHARACTER_DESCRIPTIONS,
  CHARACTER_LABELS,
  DENSITY_DESCRIPTIONS,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  MAP_TYPE_LABELS,
  MAP_TYPE_ICONS,
  MAP_HEADINGS,
  COURTYARD_DESCRIPTION,
  TOWER_STAIR_LABELS,
} from '../presentation';
import { normalizeRoomCount, stepRoomCount } from '../room-count';
import type { DraftChange, SettingsDraft } from '../settings-draft';
import { AdditionPicker } from '../addition-picker/addition-picker';
import type { MapAddition } from '../addition-picker/addition-picker';
import type { GenerationEffect, ShuffleHistoryStatus } from '../workbench-session';
import { pendingSettingChanges } from '../pending-changes';
import { CharacterPicker } from '../character-picker/character-picker';
import { CharacterPreview } from '../character-picker/character-preview';
import { CHARACTER_OPTIONS } from '../character-picker/character-options';

@Component({
  selector: 'aside[forge-settings-panel]',
  imports: [Icon, AdditionPicker, CharacterPicker, CharacterPreview],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  host: { class: 'settings-panel', 'aria-label': 'Map settings' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  readonly map = input.required<GeneratedMap>();
  readonly draft = input.required<SettingsDraft>();
  readonly pending = input.required<boolean>();
  readonly generationEffect = input.required<GenerationEffect>();
  readonly shuffleHistory = input.required<ShuffleHistoryStatus>();
  readonly disabled = input(false);
  readonly viewingPinned = input(false);
  readonly generating = input(false);
  readonly attempted = input(false);
  readonly draftChanged = output<DraftChange>();
  readonly mapTypeChanged = output<MapType>();
  readonly generateRequested = output<void>();
  readonly randomizeRequested = output<void>();
  readonly resetRequested = output<void>();
  readonly shuffleRequested = output<void>();
  readonly undoShuffleRequested = output<void>();
  readonly redoShuffleRequested = output<void>();

  private readonly characterPicker = viewChild(CharacterPicker);

  protected openCharacterPicker(): void {
    if (!this.disabled()) this.characterPicker()?.show();
  }

  protected readonly changes = computed(() => pendingSettingChanges(this.map(), this.draft()));
  protected readonly generationMessages: Readonly<Record<GenerationEffect, string>> = {
    layout: 'Generate creates a new layout.',
    appearance: 'Generate updates appearance and keeps the layout.',
    invalid: 'Correct the settings before generating.',
  };

  protected readonly additions = computed<readonly MapAddition[]>(() => {
    const draft = this.draft();
    if (draft.type === 'tower') return [];
    if (draft.type === 'courtyard')
      return [
        {
          id: 'dry-fountain',
          label: 'Dry fountain',
          description:
            'An empty stone basin that blocks three by three tiles, with a clear rim of space.',
          checked: draft.fountain,
          change: { type: 'courtyard', changes: { fountain: !draft.fountain } },
        },
      ];
    if (draft.type === 'dungeon') {
      return [
        {
          id: 'forgotten-study',
          label: 'Forgotten study',
          description: 'A desk, bookshelves, scroll cases, and a rug in one room.',
          checked: draft.scene === 'Forgotten study',
          change: {
            type: 'dungeon',
            changes: { scene: draft.scene === 'Forgotten study' ? 'None' : 'Forgotten study' },
          },
        },
        ...landmarkIdsFor('dungeon').map((id): MapAddition => ({
          id,
          label: LANDMARK_CATALOG[id].label,
          description: LANDMARK_CATALOG[id].description,
          checked: draft.landmark === id,
          change: {
            type: 'dungeon',
            changes: { landmark: draft.landmark === id ? 'None' : id },
          },
        })),
        {
          id: 'dining-table',
          label: 'Dining table',
          description: 'A wooden table that blocks two tiles, with clear space around it.',
          checked: draft.furniture === 'dining-table',
          change: {
            type: 'dungeon',
            changes: { furniture: draft.furniture === 'dining-table' ? 'None' : 'dining-table' },
          },
        },
        {
          id: 'ritual-site',
          label: 'Ritual site',
          description:
            'A stone altar, candle clusters, faded floor markings, and offerings in a clear ritual space.',
          checked: Boolean(draft.ritual),
          change: { type: 'dungeon', changes: { ritual: !draft.ritual } },
        },
      ];
    }
    return [
      {
        id: 'abandoned-camp',
        label: 'Abandoned camp',
        description: 'Two tents, bedrolls, a cold fire ring, and supplies beside the path.',
        checked: draft.scene === 'Abandoned camp',
        change: {
          type: 'forest',
          changes: { scene: draft.scene === 'Abandoned camp' ? 'None' : 'Abandoned camp' },
        },
      },
      ...landmarkIdsFor('forest').map((id): MapAddition => ({
        id,
        label: LANDMARK_CATALOG[id].label,
        description: LANDMARK_CATALOG[id].description,
        checked: draft.landmark === id,
        change: {
          type: 'forest',
          changes: { landmark: draft.landmark === id ? 'None' : id },
        },
      })),
    ];
  });
  protected readonly selectedAdditions = computed(() =>
    this.additions().filter((item) => item.checked),
  );
  protected readonly densities = ALL_DENSITIES;
  protected readonly mapTypes: readonly MapType[] = ['dungeon', 'forest', 'courtyard', 'tower'];
  protected readonly mapTypeLabels = MAP_TYPE_LABELS;
  protected readonly mapTypeIcons = MAP_TYPE_ICONS;
  protected readonly mapHeadings = MAP_HEADINGS;
  protected readonly generateLabel = computed(() =>
    this.generating()
      ? {
          tower: 'Raising your tower…',
          dungeon: 'Forging your dungeon…',
          forest: 'Growing your clearing…',
          courtyard: 'Revealing your courtyard…',
        }[this.map().type]
      : `Generate ${this.map().type}`,
  );
  protected readonly roomMin = ROOM_MIN;
  protected readonly roomMax = ROOM_MAX;
  protected readonly invalidSeed = computed(
    () => this.attempted() && (!this.draft().seed.trim() || this.draft().seed.trim().length > 64),
  );
  protected readonly invalidRooms = computed(() => {
    const draft = this.draft();
    return (
      this.attempted() &&
      draft.type === 'dungeon' &&
      (!/^\d+$/.test(draft.rooms) ||
        Number(draft.rooms) < ROOM_MIN ||
        Number(draft.rooms) > ROOM_MAX)
    );
  });
  private readonly roomDraft = computed(() => {
    const draft = this.draft();
    return draft.type === 'dungeon' ? normalizeRoomCount(draft.rooms) : undefined;
  });
  protected readonly atMinRooms = computed(() => {
    const rooms = this.roomDraft();
    return rooms !== undefined && rooms <= ROOM_MIN;
  });
  protected readonly atMaxRooms = computed(() => {
    const rooms = this.roomDraft();
    return rooms !== undefined && rooms >= ROOM_MAX;
  });
  protected readonly densityDescription = computed(
    () => DENSITY_DESCRIPTIONS[this.draft().density],
  );
  protected readonly characterOptions = computed(() => {
    const type = this.draft().type;
    return type === 'courtyard' || type === 'tower' ? [] : CHARACTER_OPTIONS[type];
  });
  protected readonly selectedCharacter = computed(() => {
    const draft = this.draft();
    const id =
      draft.type === 'dungeon'
        ? draft.preset
        : draft.type === 'forest'
          ? draft.character
          : undefined;
    return this.characterOptions().find((choice) => choice.id === id);
  });
  protected readonly characterPending = computed(() => {
    const choice = this.selectedCharacter(),
      map = this.map();
    if (choice?.type === 'dungeon' && map.type === 'dungeon')
      return choice.id !== map.decoration.preset;
    if (choice?.type === 'forest' && map.type === 'forest')
      return choice.id !== map.decoration.character;
    return false;
  });
  protected readonly styleDescription = computed(() => {
    const map = this.map();
    if (map.type === 'tower')
      return 'Connected stone chambers, arcane details, and a clear route between floors.';
    if (map.type === 'courtyard') return COURTYARD_DESCRIPTION;
    return map.type === 'dungeon'
      ? PRESET_DESCRIPTIONS[map.decoration.preset]
      : CHARACTER_DESCRIPTIONS[map.decoration.character];
  });
  protected readonly styleLabel = computed(() => {
    const map = this.map();
    if (map.type === 'tower') return 'Ruined wizard’s tower';
    if (map.type === 'courtyard') return 'Overgrown ruin';
    if (map.type === 'forest') return CHARACTER_LABELS[map.decoration.character];
    return PRESET_LABELS[map.decoration.preset];
  });

  protected editSeed(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.draftChanged.emit({ type: this.draft().type, changes: { seed: event.target.value } });
  }

  protected removeAddition(change: DraftChange, chooser: HTMLButtonElement): void {
    this.draftChanged.emit(change);
    chooser.focus();
  }

  protected restoreShuffle(direction: 'undo' | 'redo'): void {
    // Keep these controls focusable at the history boundary and during the busy state.
    if (this.disabled() || this.shuffleHistory()[direction] === 0) return;
    if (direction === 'undo') this.undoShuffleRequested.emit();
    else this.redoShuffleRequested.emit();
  }

  protected editRooms(event: Event): void {
    if (this.draft().type === 'dungeon' && event.target instanceof HTMLInputElement)
      this.draftChanged.emit({ type: 'dungeon', changes: { rooms: event.target.value } });
  }

  protected stepRooms(delta: number): void {
    const draft = this.draft();
    if (draft.type === 'dungeon')
      this.draftChanged.emit({
        type: 'dungeon',
        changes: { rooms: stepRoomCount(draft.rooms, delta) },
      });
  }

  protected readonly stairStyles = TOWER_STAIR_STYLES;
  protected readonly stairLabels = TOWER_STAIR_LABELS;
  protected editStairStyle(event: Event): void {
    if (
      this.disabled() ||
      this.draft().type !== 'tower' ||
      !(event.target instanceof HTMLSelectElement)
    )
      return;
    const value = event.target.value;
    const style = TOWER_STAIR_STYLES.find((style) => style === value);
    if (style) this.draftChanged.emit({ type: 'tower', changes: { stairStyle: style } });
  }
  protected readonly floorCounts = [3, 4, 5, 6, 7, 8];
  protected readonly portalSources = computed(() => {
    const draft = this.draft();
    const count = draft.type === 'tower' ? Number(draft.floors) : 0;
    return Number.isInteger(count) && count >= 3 && count <= 8
      ? Array.from({ length: count }, (_, i) => i + 1)
      : [];
  });
  protected editFloors(event: Event): void {
    const draft = this.draft();
    if (this.disabled() || draft.type !== 'tower' || !(event.target instanceof HTMLSelectElement))
      return;
    const floors = event.target.value;
    this.draftChanged.emit({
      type: 'tower',
      changes: {
        floors,
        portalFloor:
          draft.portalFloor !== 'none' && Number(draft.portalFloor) > Number(floors)
            ? 'none'
            : draft.portalFloor,
      },
    });
  }
  protected editPortal(event: Event): void {
    if (
      !this.disabled() &&
      this.draft().type === 'tower' &&
      event.target instanceof HTMLSelectElement
    )
      this.draftChanged.emit({ type: 'tower', changes: { portalFloor: event.target.value } });
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    this.generateRequested.emit();
  }
}
