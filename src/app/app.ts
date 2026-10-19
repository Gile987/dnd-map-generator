import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ALL_FOREST_CHARACTERS, ALL_PRESETS } from './engine/model';
import type {
  DecorationPreset,
  Density,
  ForestCharacter,
  GeneratedMap,
  MapType,
} from './engine/model';
import { downloadPng } from './rendering/export';
import { EXPORT_HEIGHT, EXPORT_WIDTH } from './rendering/resolution';
import { Icon } from './icon';
import { Preview } from './preview/preview';
import { Library } from './save/library';
import { ROOM_MAX, ROOM_MIN, normalizeRoomCount, stepRoomCount } from './room-count';
import { WorkbenchSession } from './workbench/workbench-session';
import type { SettingsDraft } from './workbench/workbench-session';

type Operation = 'generation' | 'details' | 'export';

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

function yieldForUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

@Component({
  selector: 'app-root',
  imports: [Icon, Library, Preview],
  providers: [WorkbenchSession],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly session = inject(WorkbenchSession);
  protected readonly mapType = this.session.mapType;
  protected readonly map = this.session.map;
  private readonly draft = this.session.draft;
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
  protected readonly pending = this.session.pending;
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
      this.session.selectMapType(type);
      if (type === 'forest') {
        this.status.set('Forest clearing restored. A woodland path awaits.');
      } else {
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
    this.session.resetChanges();
    this.attempted.set(false);
    this.error.set('');
    this.status.set('Pending settings reset. Your displayed map is unchanged.');
  }

  protected async shuffle(): Promise<void> {
    await this.run('details', () => {
      this.session.shuffle();
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
    this.session.openSaved(map);
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
    this.session.updateDraft(changes);
    this.attempted.set(false);
    this.error.set('');
  }

  private async generate(): Promise<void> {
    if (this.busy() || !this.pending()) return;
    this.attempted.set(true);
    const validation = this.session.validationError();
    if (validation) {
      this.error.set(validation);
      return;
    }

    await this.run('generation', () => {
      const result = this.session.generate();
      if (!result.ok) throw new Error(result.error);
      this.attempted.set(false);
      this.status.set(
        result.layoutChanged
          ? this.mapType() === 'dungeon'
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
