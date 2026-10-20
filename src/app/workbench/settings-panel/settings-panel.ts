import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ALL_FOREST_CHARACTERS, ALL_PRESETS } from '../../engine/model';
import type {
  DecorationPreset,
  Density,
  ForestCharacter,
  GeneratedMap,
  MapType,
} from '../../engine/model';
import { Icon } from '../../icon';
import { ROOM_MAX, ROOM_MIN, normalizeRoomCount, stepRoomCount } from '../../room-count';
import type { DraftChange, SettingsDraft } from '../settings-draft';

const PRESET_DESCRIPTIONS: Readonly<Record<DecorationPreset, string>> = {
  Mosslit: 'Cool slate. Soft moss. A warm glow.',
  Crypt: 'Stone sarcophagi and subdued lantern light.',
  Storehouse: 'Crates, barrels, and worn runners.',
  Sanctuary: 'Moss, vines, and broken architecture.',
};

const CHARACTER_DESCRIPTIONS: Readonly<Record<ForestCharacter, string>> = {
  Verdant: 'Lush broadleaf woodland with ferns and mossy logs.',
  Autumn: 'Gold and russet canopies over fallen leaves.',
  Pines: 'Ancient evergreens on a needle-covered floor.',
  Fey: 'Unusual trees, flowering moss, and faint glimmers.',
};

const CHARACTER_LABELS: Readonly<Record<ForestCharacter, string>> = {
  Verdant: 'Verdant woodland',
  Autumn: 'Autumn grove',
  Pines: 'Ancient pines',
  Fey: 'Fey glade',
};

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

  protected readonly densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
  protected readonly presets = ALL_PRESETS;
  protected readonly characters = ALL_FOREST_CHARACTERS;
  protected readonly characterNames = CHARACTER_LABELS;
  protected readonly mapTypes: readonly MapType[] = ['dungeon', 'forest'];
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
    () =>
      ({
        Sparse: 'Quiet spaces, room to imagine.',
        Balanced: 'A little character. Plenty of space.',
        Cluttered: 'Storied spaces, with paths kept clear.',
      })[this.draft().density],
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
    return (
      {
        Mosslit: 'Mosslit stone',
        Crypt: 'Ancient crypt',
        Storehouse: 'Abandoned storehouse',
        Sanctuary: 'Overgrown sanctuary',
      } as const
    )[map.decoration.preset];
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
