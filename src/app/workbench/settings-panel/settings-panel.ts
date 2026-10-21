import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ALL_DENSITIES,
  ALL_FOREST_CHARACTERS,
  ALL_PRESETS,
  ROOM_MAX,
  ROOM_MIN,
} from '../../engine/model';
import type { GeneratedMap, MapType } from '../../engine/model';
import { Icon } from '../../icon';
import {
  CHARACTER_DESCRIPTIONS,
  CHARACTER_LABELS,
  DENSITY_DESCRIPTIONS,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
} from '../presentation';
import { normalizeRoomCount, stepRoomCount } from '../room-count';
import type { DraftChange, SettingsDraft } from '../settings-draft';

@Component({
  selector: 'aside[forge-settings-panel]',
  imports: [Icon],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  host: { class: 'settings-panel', 'aria-label': 'Map settings' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  readonly map = input.required<GeneratedMap>();
  readonly draft = input.required<SettingsDraft>();
  readonly pending = input.required<boolean>();
  readonly disabled = input(false);
  readonly generating = input(false);
  readonly attempted = input(false);
  readonly draftChanged = output<DraftChange>();
  readonly mapTypeChanged = output<MapType>();
  readonly generateRequested = output<void>();
  readonly randomizeRequested = output<void>();
  readonly resetRequested = output<void>();
  readonly shuffleRequested = output<void>();

  protected readonly densities = ALL_DENSITIES;
  protected readonly presets = ALL_PRESETS;
  protected readonly characters = ALL_FOREST_CHARACTERS;
  protected readonly characterNames = CHARACTER_LABELS;
  protected readonly mapTypes: readonly MapType[] = ['dungeon', 'forest'];
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
  protected readonly draftStyleDescription = computed(() => {
    const draft = this.draft();
    return draft.type === 'dungeon'
      ? PRESET_DESCRIPTIONS[draft.preset]
      : CHARACTER_DESCRIPTIONS[draft.character];
  });
  protected readonly styleDescription = computed(() => {
    const map = this.map();
    return map.type === 'dungeon'
      ? PRESET_DESCRIPTIONS[map.decoration.preset]
      : CHARACTER_DESCRIPTIONS[map.decoration.character];
  });
  protected readonly styleLabel = computed(() => {
    const map = this.map();
    if (map.type === 'forest') return CHARACTER_LABELS[map.decoration.character];
    return PRESET_LABELS[map.decoration.preset];
  });

  protected editSeed(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.draftChanged.emit({ type: this.draft().type, changes: { seed: event.target.value } });
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

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    this.generateRequested.emit();
  }
}
