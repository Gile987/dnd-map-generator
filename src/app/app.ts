import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { generateDungeon } from './engine/generate';
import {
  generateForestClearing,
  changeForestDensity,
  shuffleForestDetails,
} from './engine/forest-generate';
import { changeDensity, changePreset, shuffleDetails } from './engine/decoration';
import { ALL_PRESETS, DEFAULT_PRESET } from './engine/model';
import type {
  DecorationPreset,
  Density,
  Dungeon,
  DungeonSettings,
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
import { ROOM_DEFAULT, ROOM_MAX, ROOM_MIN, normalizeRoomCount, stepRoomCount } from './room-count';

type Operation = 'generation' | 'details' | 'export';

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
  imports: [Icon, Preview],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly mapType = signal<MapType>('dungeon');
  protected readonly map = signal<GeneratedMap>(initialMap());
  private readonly lastDungeon = signal<Dungeon>(initialMap());
  private readonly lastForest = signal<ForestClearing>(initialForestMap());
  protected readonly seed = signal('mosslit-sanctum');
  protected readonly rooms = signal(ROOM_DEFAULT);
  protected readonly grid = signal(true);
  protected readonly busy = signal<Operation | null>(null);
  protected readonly error = signal('');
  protected readonly status = signal('Your dungeon is ready.');
  protected readonly attempted = signal(false);
  protected readonly densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
  protected readonly presets: readonly DecorationPreset[] = ALL_PRESETS;
  protected readonly mapTypes: readonly MapType[] = ['dungeon', 'forest'];
  protected readonly exportSize = `${EXPORT_WIDTH} × ${EXPORT_HEIGHT} px`;
  protected readonly pending = computed(() => {
    const m = this.map();
    if (this.seed().trim() !== m.seed) return true;
    if (m.type === 'dungeon' && this.mapType() === 'dungeon') {
      return Number(this.rooms()) !== m.layout.rooms.length;
    }
    return false;
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
      })[this.map().decoration.density],
  );
  protected readonly presetDescription = computed(() => {
    const m = this.map();
    if (m.type !== 'dungeon') return '';
    return (
      {
        Mosslit: 'Cool slate. Soft moss. A warm glow.',
        Crypt: 'Stone sarcophagi and subdued lantern light.',
        Storehouse: 'Crates, barrels, and worn runners.',
        Sanctuary: 'Moss, vines, and broken architecture.',
      } as const
    )[m.decoration.preset];
  });
  protected readonly presetLabel = computed(() => {
    const m = this.map();
    if (m.type !== 'dungeon') return '';
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
  protected readonly dungeonRoomCount = computed(() => {
    const m = this.map();
    return m.type === 'dungeon' ? m.layout.rooms.length : 0;
  });
  protected readonly currentPreset = computed(() => {
    const m = this.map();
    return m.type === 'dungeon' ? m.decoration.preset : '';
  });
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
      details: `${m.decoration.density} r${m.decoration.revision}`,
      type: 'FOREST CLEARING',
    };
  });

  protected editSeed(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.seed.set(event.target.value);
  }

  protected editRooms(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.rooms.set(event.target.value);
  }

  protected stepRooms(delta: number): void {
    this.rooms.set(stepRoomCount(this.rooms(), delta));
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

  protected async newSeed(): Promise<void> {
    if (this.busy()) return;
    const values = crypto.getRandomValues(new Uint32Array(2));
    this.seed.set(
      `dungeon-${Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('')}`,
    );
    await this.generate();
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

  protected async selectDensity(density: Density): Promise<void> {
    if (density === this.map().decoration.density) return;
    await this.run('details', () => {
      this.map.update((map) => {
        const updated =
          map.type === 'dungeon' ? changeDensity(map, density) : changeForestDensity(map, density);
        if (updated.type === 'dungeon') this.lastDungeon.set(updated);
        else this.lastForest.set(updated);
        return updated;
      });
      this.status.set(`${density} decoration applied. Your layout is preserved.`);
    });
  }

  protected async selectPreset(preset: DecorationPreset): Promise<void> {
    const m = this.map();
    if (m.type !== 'dungeon') return;
    if (preset === m.decoration.preset) return;
    await this.run('details', () => {
      this.map.update((map) => {
        if (map.type !== 'dungeon') return map;
        const updated = changePreset(map, preset);
        this.lastDungeon.set(updated);
        return updated;
      });
      this.status.set(`${preset} character applied. Your layout is preserved.`);
    });
  }

  protected async export(): Promise<void> {
    await this.run('export', async () => {
      await downloadPng(this.map(), this.grid());
      this.status.set(
        `Your ${EXPORT_WIDTH} × ${EXPORT_HEIGHT} PNG is ready. Check your downloads.`,
      );
    });
  }

  private async generate(): Promise<void> {
    if (this.busy()) return;
    this.attempted.set(true);
    const type = this.mapType();

    if (type === 'forest') {
      const settings: ForestSettings = {
        seed: this.seed(),
        density: this.map().decoration.density,
      };
      const validation = validateForestSettings(settings);
      if (validation) {
        this.error.set(validation);
        return;
      }
      await this.run('generation', () => {
        const result = generateForestClearing(settings);
        if (!result.ok) throw new Error(result.error);
        this.lastForest.set(result.map);
        this.map.set(result.map);
        this.seed.set(result.map.seed);
        this.attempted.set(false);
        this.status.set('A new forest clearing is ready.');
      });
      return;
    }

    const currentMap = this.map();
    const settings: DungeonSettings = {
      seed: this.seed(),
      roomCount: Number(this.rooms()),
      density: currentMap.decoration.density,
      preset: currentMap.type === 'dungeon' ? currentMap.decoration.preset : DEFAULT_PRESET,
    };
    const validation = validateSettings(settings);
    if (validation || !/^\d+$/.test(this.rooms())) {
      this.error.set(validation ?? 'Choose a whole number of rooms from 4 to 8.');
      return;
    }
    await this.run('generation', () => {
      const result = generateDungeon(settings);
      if (!result.ok) throw new Error(result.error);
      this.lastDungeon.set(result.map);
      this.map.set(result.map);
      this.seed.set(result.map.seed);
      this.rooms.set(String(result.map.layout.rooms.length));
      this.attempted.set(false);
      this.status.set('A new dungeon is ready. Let the story begin.');
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
