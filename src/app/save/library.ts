import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { GeneratedMap } from '../engine/model';
import { downloadBlob } from '../browser/download';
import { Icon } from '../icon';
import { createThumbnail } from '../rendering/thumbnail';
import { defaultMapName, mapSummary, parseBundle } from './save-format';
import type { SavedMap } from './save-format';
import { SaveStore } from './save-store';

@Component({
  selector: 'forge-library',
  imports: [Icon],
  templateUrl: './library.html',
  styleUrl: './library.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Library {
  readonly map = input.required<GeneratedMap>();
  readonly disabled = input(false);
  readonly open = output<GeneratedMap>();

  private readonly store = inject(SaveStore);

  protected readonly name = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editDraft = signal('');
  protected readonly notice = signal('');
  protected readonly error = signal('');

  protected readonly saved = computed(() =>
    [...this.store.saved()].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return b.savedAt.localeCompare(a.savedAt);
    }),
  );
  protected readonly placeholder = computed(() => defaultMapName(this.map()));

  protected readonly summaryOf = (record: SavedMap): string => mapSummary(record.map);

  protected editName(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.name.set(event.target.value);
  }

  protected editRename(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.editDraft.set(event.target.value);
  }

  protected save(): void {
    const map = this.map();
    let thumbnail: string;
    try {
      thumbnail = createThumbnail(map);
    } catch {
      this.error.set('A thumbnail for this map could not be created. Please try again.');
      return;
    }
    const chosenName = this.name().trim() || defaultMapName(map);
    try {
      const record = this.store.add(map, chosenName, thumbnail);
      this.name.set('');
      this.error.set('');
      this.notice.set(`Saved “${record.name}”.`);
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error ? error.message : 'This map could not be saved. Please try again.',
      );
    }
  }

  protected openMap(record: SavedMap): void {
    this.open.emit(record.map);
  }

  protected startRename(record: SavedMap): void {
    this.editingId.set(record.id);
    this.editDraft.set(record.name);
  }

  protected commitRename(event: SubmitEvent, record: SavedMap): void {
    event.preventDefault();
    const name = this.editDraft().trim() || record.name;
    if (this.runStore(() => this.store.rename(record.id, name))) {
      this.editingId.set(null);
      this.notice.set(`Renamed to “${name}”.`);
    }
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  protected removeMap(record: SavedMap): void {
    if (this.runStore(() => this.store.remove(record.id))) {
      this.notice.set(`Deleted “${record.name}”.`);
    }
  }

  protected duplicateMap(record: SavedMap): void {
    if (this.runStore(() => this.store.duplicate(record.id))) {
      this.notice.set(`Duplicated “${record.name}”.`);
    }
  }

  protected toggleFavorite(record: SavedMap): void {
    this.runStore(() => this.store.toggleFavorite(record.id));
  }

  protected downloadBackup(): void {
    try {
      const bundle = this.store.exportBundle();
      downloadBlob(
        new Blob([bundle], { type: 'application/json' }),
        'encounter-map-forge-saves.json',
      );
      this.error.set('');
      this.notice.set('Backup downloaded.');
    } catch {
      this.notice.set('');
      this.error.set('This backup could not be downloaded. Please try again.');
    }
  }

  protected async importBackup(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const result = parseBundle(await file.text());
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      const { added, skipped: duplicateSkips } = this.store.importMaps(result.maps);
      const skipped = result.skipped + duplicateSkips;
      this.error.set('');
      this.notice.set(
        skipped > 0
          ? `Imported ${added} ${added === 1 ? 'map' : 'maps'}; ${skipped} ${skipped === 1 ? 'entry' : 'entries'} skipped.`
          : `Imported ${added} ${added === 1 ? 'map' : 'maps'}.`,
      );
    } catch {
      this.error.set('That backup file could not be read.');
    } finally {
      target.value = '';
    }
  }

  private runStore(action: () => void): boolean {
    try {
      action();
      this.error.set('');
      return true;
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'This change could not be saved. Please try again.',
      );
      return false;
    }
  }
}
