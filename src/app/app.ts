import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { generateDungeon } from './engine/generate';
import {
  changeForestCharacter,
  changeForestDensity,
  generateForestClearing,
  shuffleForestDetails,
} from './engine/forest-generate';
import { changeDensity, changePreset, shuffleDetails } from './engine/decoration';
import {
  ALL_FOREST_CHARACTERS,
  ALL_PRESETS,
  DEFAULT_FOREST_CHARACTER,
  DEFAULT_PRESET,
} from './engine/model';
import type {
  DecorationPreset,
  Density,
  Dungeon,
  DungeonSettings,
  ForestCharacter,
  ForestClearing,
  ForestSettings,
  GeneratedMap,
  MapType,
} from './engine/model';
import { validateSettings } from './engine/validation';
import { validateForestSettings } from './engine/forest-generate';
import { downloadPng } from './rendering/export';
import { EXPORT_HEIGHT, EXPORT_WIDTH } from './rendering/resolution';
import { Icon } from './icon';
import { Preview } from './preview/preview';
import { Library } from './save/library';
import { ROOM_DEFAULT, ROOM_MAX, ROOM_MIN, normalizeRoomCount, stepRoomCount } from './room-count';

type Operation = 'generation' | 'details' | 'export';

interface SettingsDraft {
  readonly seed: string;
  readonly rooms: string;
  readonly density: Density;
  readonly preset: DecorationPreset;
  readonly character: ForestCharacter;
}

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

function draftForMap(map: GeneratedMap): SettingsDraft {
  return {
    seed: map.seed,
    rooms: map.type === 'dungeon' ? String(map.layout.rooms.length) : ROOM_DEFAULT,
    density: map.decoration.density,
    preset: map.type === 'dungeon' ? map.decoration.preset : DEFAULT_PRESET,
    character: map.type === 'forest' ? map.decoration.character : DEFAULT_FOREST_CHARACTER,
  };
}

function initialMap(): Dungeon {
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: DEFAULT_PRESET,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

function initialForestMap(): ForestClearing {
  const result = generateForestClearing({
    seed: 'mosslit-sanctum',
    density: 'Balanced',
    character: DEFAULT_FOREST_CHARACTER,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

function yieldForUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

@Component({
  selector: 'app-root',
  imports: [Icon, Library, Preview],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly mapType = signal<MapType>('dungeon');
  protected readonly map = signal<GeneratedMap>(initialMap());
  private readonly lastDungeon = signal<Dungeon>(initialMap());
  private readonly lastForest = signal<ForestClearing>(initialForestMap());
  private readonly drafts = signal<Record<MapType, SettingsDraft>>({
    dungeon: draftForMap(this.lastDungeon()),
    forest: draftForMap(this.lastForest()),
  });
  private readonly draft = computed(() => this.drafts()[this.mapType()]);
  protected readonly seed = computed(() => this.draft().seed);
  protected readonly rooms = computed(() => this.draft().rooms);
  protected readonly density = computed(() => this.draft().density);
  protected readonly preset = computed(() => this.draft().preset);
  protected readonly character = computed(() => this.draft().character);
  protected readonly grid = signal(true);
  protected readonly busy = signal<Operation | null>(null);
  protected readonly error = signal('');
  protected readonly status = signal('Your dungeon is ready.');
  protected readonly attempted = signal(false);
  protected readonly densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
  protected readonly presets: readonly DecorationPreset[] = ALL_PRESETS;
  protected readonly characters: readonly ForestCharacter[] = ALL_FOREST_CHARACTERS;
  protected readonly characterNames: Readonly<Record<ForestCharacter, string>> = CHARACTER_LABELS;
  protected readonly mapTypes: readonly MapType[] = ['dungeon', 'forest'];
  protected readonly exportSize = `${EXPORT_WIDTH} × ${EXPORT_HEIGHT} px`;
  private readonly layoutPending = computed(() => {
    const map = this.map();
    return (
      this.seed().trim() !== map.seed ||
      (map.type === 'dungeon' &&
        (!/^\d+$/.test(this.rooms()) || Number(this.rooms()) !== map.layout.rooms.length))
    );
  });
  protected readonly pending = computed(() => {
    const map = this.map();
    return (
      this.layoutPending() ||
      this.density() !== map.decoration.density ||
      (map.type === 'dungeon' && this.preset() !== map.decoration.preset) ||
      (map.type === 'forest' && this.character() !== map.decoration.character)
    );
  });
  protected readonly invalidSeed = computed(
    () => this.attempted() && (!this.seed().trim() || this.seed().trim().length > 64),
  );
  protected readonly invalidRooms = computed(
    () =>
      this.attempted() &&
      this.mapType() === 'dungeon' &&
      (!/^\d+$/.test(this.rooms()) ||
        Number(this.rooms()) < ROOM_MIN ||
        Number(this.rooms()) > ROOM_MAX),
  );
  protected readonly roomDraft = computed(() => normalizeRoomCount(this.rooms()));
  protected readonly atMinRooms = computed(() => this.roomDraft() <= ROOM_MIN);
  protected readonly atMaxRooms = computed(() => this.roomDraft() >= ROOM_MAX);
  protected readonly densityDescription = computed(
    () =>
      ({
        Sparse: 'Quiet spaces, room to imagine.',
        Balanced: 'A little character. Plenty of space.',
        Cluttered: 'Storied spaces, with paths kept clear.',
      })[this.density()],
  );
  protected readonly draftStyleDescription = computed(() =>
    this.mapType() === 'dungeon'
      ? PRESET_DESCRIPTIONS[this.preset()]
      : CHARACTER_DESCRIPTIONS[this.character()],
  );
  protected readonly styleDescription = computed(() => {
    const map = this.map();
    return map.type === 'dungeon'
      ? PRESET_DESCRIPTIONS[map.decoration.preset]
      : CHARACTER_DESCRIPTIONS[map.decoration.character];
  });
  protected readonly styleLabel = computed(() => {
    const m = this.map();
    if (m.type === 'forest') return CHARACTER_LABELS[m.decoration.character];
    return (
      {
        Mosslit: 'Mosslit stone',
        Crypt: 'Ancient crypt',
        Storehouse: 'Abandoned storehouse',
        Sanctuary: 'Overgrown sanctuary',
      } as const
    )[m.decoration.preset];
  });
  protected readonly mapTypeLabel = computed(() =>
    this.map().type === 'dungeon' ? 'Stone Dungeon' : 'Forest Clearing',
  );
  protected readonly mapSummary = computed(() => {
    const m = this.map();
    if (m.type === 'dungeon') {
      return {
        seed: m.seed,
        rooms: `${m.layout.rooms.length} connected`,
        details: `${m.decoration.preset} · ${m.decoration.density} r${m.decoration.revision}`,
        type: 'STONE DUNGEON',
      };
    }
    return {
      seed: m.seed,
      rooms: 'Open clearing',
      details: `${m.decoration.character} · ${m.decoration.density} r${m.decoration.revision}`,
      type: 'FOREST CLEARING',
    };
  });

  protected editSeed(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.updateDraft({ seed: event.target.value });
  }

  protected editRooms(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.updateDraft({ rooms: event.target.value });
  }

  protected stepRooms(delta: number): void {
    this.updateDraft({ rooms: stepRoomCount(this.rooms(), delta) });
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    void this.generate();
  }

  protected async selectMapType(type: MapType): Promise<void> {
    if (this.busy()) return;
    if (type === this.mapType()) return;
    await this.run('generation', () => {
      this.mapType.set(type);
      if (type === 'forest') {
        this.map.set(this.lastForest());
        this.status.set('Forest clearing restored. A woodland path awaits.');
      } else {
        this.map.set(this.lastDungeon());
        this.status.set('Dungeon restored. Let the story begin.');
      }
    });
  }

  protected randomizeSeed(): void {
    if (this.busy()) return;
    const values = crypto.getRandomValues(new Uint32Array(2));
    this.updateDraft({
      seed: `${this.mapType()}-${Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('')}`,
    });
  }

  protected resetChanges(): void {
    if (this.busy()) return;
    this.resetDraft(this.map());
    this.attempted.set(false);
    this.error.set('');
    this.status.set('Pending settings reset. Your displayed map is unchanged.');
  }

  protected async shuffle(): Promise<void> {
    await this.run('details', () => {
      this.map.update((map) => {
        if (map.type === 'dungeon') {
          const shuffled = shuffleDetails(map);
          this.lastDungeon.set(shuffled);
          return shuffled;
        }
        const shuffled = shuffleForestDetails(map);
        this.lastForest.set(shuffled);
        return shuffled;
      });
      this.status.set(
        this.map().type === 'dungeon'
          ? 'Details shuffled. Your layout and floor texture are preserved.'
          : 'Details shuffled. The clearing layout is preserved.',
      );
    });
  }

  protected selectDensity(density: Density): void {
    this.updateDraft({ density });
  }

  protected selectPreset(preset: DecorationPreset): void {
    this.updateDraft({ preset });
  }

  protected selectCharacter(character: ForestCharacter): void {
    this.updateDraft({ character });
  }

  protected openSaved(map: GeneratedMap): void {
    if (this.busy()) return;
    this.mapType.set(map.type);
    if (map.type === 'dungeon') {
      this.lastDungeon.set(map);
    } else {
      this.lastForest.set(map);
    }
    this.map.set(map);
    this.resetDraft(map);
    this.attempted.set(false);
    this.error.set('');
    this.status.set(
      map.type === 'dungeon'
        ? 'Map opened from your library.'
        : 'Clearing opened from your library.',
    );
  }

  protected async export(): Promise<void> {
    await this.run('export', async () => {
      await downloadPng(this.map(), this.grid());
      this.status.set(
        `Your ${EXPORT_WIDTH} × ${EXPORT_HEIGHT} PNG is ready. Check your downloads.`,
      );
    });
  }

  private updateDraft(changes: Partial<SettingsDraft>): void {
    if (this.busy()) return;
    const type = this.mapType();
    this.drafts.update((drafts) => ({ ...drafts, [type]: { ...drafts[type], ...changes } }));
    this.attempted.set(false);
    this.error.set('');
  }

  private resetDraft(map: GeneratedMap): void {
    this.drafts.update((drafts) => ({ ...drafts, [map.type]: draftForMap(map) }));
  }

  private async generate(): Promise<void> {
    if (this.busy() || !this.pending()) return;
    this.attempted.set(true);
    const current = this.map();
    const draft = this.draft();
    const layoutChanged = this.layoutPending();
    const settings: DungeonSettings & ForestSettings = {
      seed: draft.seed,
      roomCount: Number(draft.rooms),
      density: draft.density,
      preset: draft.preset,
      character: draft.character,
    };
    const validation =
      current.type === 'forest'
        ? validateForestSettings(settings)
        : validateSettings(settings) ||
          (!/^\d+$/.test(draft.rooms) ? 'Choose a whole number of rooms from 4 to 8.' : undefined);
    if (validation) {
      this.error.set(validation);
      return;
    }

    await this.run('generation', () => {
      let next: GeneratedMap;
      if (layoutChanged) {
        const result =
          current.type === 'dungeon' ? generateDungeon(settings) : generateForestClearing(settings);
        if (!result.ok) throw new Error(result.error);
        next = result.map;
      } else if (current.type === 'forest') {
        next = current;
        if (draft.density !== next.decoration.density)
          next = changeForestDensity(next, draft.density);
        if (draft.character !== next.decoration.character)
          next = changeForestCharacter(next, draft.character);
      } else {
        next = current;
        if (draft.density !== current.decoration.density) next = changeDensity(next, draft.density);
        if (draft.preset !== current.decoration.preset) next = changePreset(next, draft.preset);
      }
      if (next.decoration.density !== draft.density) {
        throw new Error('Those decoration settings could not be applied. Try another density.');
      }
      if (next.type === 'forest' && next.decoration.character !== draft.character) {
        throw new Error('That forest character could not be applied. Try another seed.');
      }
      if (next.type === 'dungeon') this.lastDungeon.set(next);
      else this.lastForest.set(next);
      this.map.set(next);
      this.resetDraft(next);
      this.attempted.set(false);
      this.status.set(
        layoutChanged
          ? current.type === 'dungeon'
            ? 'A new dungeon is ready. Let the story begin.'
            : 'A new forest clearing is ready.'
          : 'Settings applied. Your layout and detail revision are preserved.',
      );
    });
  }

  private async run(kind: Operation, action: () => void | Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(kind);
    this.error.set('');
    await yieldForUi();
    try {
      await action();
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Your last map is still available; please try again.',
      );
    } finally {
      this.busy.set(null);
    }
  }
}
