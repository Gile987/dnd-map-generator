import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { generateDungeon } from './engine/generate';
import { changeDensity, shuffleDetails } from './engine/decoration';
import type { Density, Dungeon, Settings } from './engine/model';
import { validateSettings } from './engine/validation';
import { downloadPng } from './rendering/export';
import { EXPORT_HEIGHT, EXPORT_WIDTH } from './rendering/resolution';
import { Icon } from './icon';
import { Preview } from './preview/preview';
import { ROOM_DEFAULT, ROOM_MAX, ROOM_MIN, normalizeRoomCount, stepRoomCount } from './room-count';

function initialMap(): Dungeon {
  const result = generateDungeon({ seed: 'mosslit-sanctum', roomCount: 6, density: 'Balanced' });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

@Component({
  selector: 'app-root',
  imports: [Icon, Preview],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly map = signal(initialMap());
  protected readonly seed = signal('mosslit-sanctum');
  protected readonly rooms = signal(ROOM_DEFAULT);
  protected readonly grid = signal(true);
  protected readonly busy = signal<'generation' | 'details' | 'export' | null>(null);
  protected readonly error = signal('');
  protected readonly status = signal('Your dungeon is ready.');
  protected readonly attempted = signal(false);
  protected readonly densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
  protected readonly exportSize = `${EXPORT_WIDTH} × ${EXPORT_HEIGHT} px`;
  protected readonly pending = computed(
    () =>
      this.seed().trim() !== this.map().seed ||
      Number(this.rooms()) !== this.map().layout.rooms.length,
  );
  protected readonly invalidSeed = computed(
    () => this.attempted() && (!this.seed().trim() || this.seed().trim().length > 64),
  );
  protected readonly invalidRooms = computed(
    () =>
      this.attempted() &&
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
        Sparse: 'Quiet rooms, room to imagine.',
        Balanced: 'A little character. Plenty of space.',
        Cluttered: 'Storied rooms, with paths kept clear.',
      })[this.map().decoration.density],
  );

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
      this.map.update((map) => shuffleDetails(map));
      this.status.set('Details shuffled. Your layout and floor texture are preserved.');
    });
  }

  protected async selectDensity(density: Density): Promise<void> {
    if (density === this.map().decoration.density) return;
    await this.run('details', () => {
      this.map.update((map) => changeDensity(map, density));
      this.status.set(`${density} decoration applied. Your layout is preserved.`);
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
    const settings: Settings = {
      seed: this.seed(),
      roomCount: Number(this.rooms()),
      density: this.map().decoration.density,
    };
    const validation = validateSettings(settings);
    if (validation || !/^\d+$/.test(this.rooms())) {
      this.error.set(validation ?? 'Choose a whole number of rooms from 4 to 8.');
      return;
    }
    await this.run('generation', () => {
      const result = generateDungeon(settings);
      if (!result.ok) throw new Error(result.error);
      this.map.set(result.map);
      this.seed.set(result.map.seed);
      this.rooms.set(String(result.map.layout.rooms.length));
      this.attempted.set(false);
      this.status.set('A new dungeon is ready. Let the story begin.');
    });
  }

  private async run(
    kind: 'generation' | 'details' | 'export',
    action: () => void | Promise<void>,
  ): Promise<void> {
    if (this.busy()) return;
    this.busy.set(kind);
    this.error.set('');
    await new Promise<void>((resolve) => setTimeout(resolve, 16));
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
