import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { GeneratedMap, MapType } from '../engine/model';
import { downloadBlob } from '../browser/download';
import { Icon } from '../icon';
import { createThumbnail } from '../rendering/thumbnail';
import { defaultMapName, mapSummary, parseBundle } from './save-format';
import type { SavedMap } from './save-format';
import { SaveStore } from './save-store';
import { MAP_TYPE_LABELS } from '../workbench/presentation';
import { DEFAULT_LIBRARY_VIEW, LIBRARY_SORT_OPTIONS, viewSavedMaps } from './library-view';
import type { LibraryView } from './library-view';

@Component({
  selector: 'forge-library',
  imports: [Icon],
  templateUrl: './library.html',
  styleUrl: './library.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Library {
  protected readonly mapTypeLabels = MAP_TYPE_LABELS;
  readonly map = input.required<GeneratedMap>();
  readonly disabled = input(false);
  readonly open = output<GeneratedMap>();

  private readonly store = inject(SaveStore);
  private readonly injector = inject(Injector);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('librarySearch');

  protected readonly name = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editDraft = signal('');
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly undoError = signal('');
  protected readonly working = signal(false);
  protected readonly blocked = computed(() => this.disabled() || this.working());
  protected readonly writeBlocked = computed(() => this.blocked() || !this.store.canWrite());
  protected readonly libraryProblem = this.store.problem;
  protected readonly recoveryData = this.store.recoveryData;

  protected readonly saved = this.store.saved;
  protected readonly lastDeleted = this.store.lastDeleted;
  protected readonly deletionMessage = computed(() => {
    const deleted = this.lastDeleted();
    return deleted ? `Deleted “${deleted.name}”.` : '';
  });
  protected readonly view = signal<LibraryView>(DEFAULT_LIBRARY_VIEW);
  protected readonly visibleMaps = computed(() => viewSavedMaps(this.saved(), this.view()));
  protected readonly mapTypes: readonly MapType[] = ['dungeon', 'forest', 'courtyard'];
  protected readonly sortOptions = LIBRARY_SORT_OPTIONS;
  protected readonly hasFilters = computed(() => {
    const view = this.view();
    return view.query !== '' || view.mapType !== 'all' || view.favoritesOnly;
  });
  protected readonly placeholder = computed(() => defaultMapName(this.map()));

  protected readonly summaryOf = (record: SavedMap): string => mapSummary(record.map);

  protected search(event: Event): void {
    if (this.blocked() || !(event.target instanceof HTMLInputElement)) return;
    const query = event.target.value;
    this.view.update((view) => ({ ...view, query }));
  }

  protected filterMapType(event: Event): void {
    if (this.blocked() || !(event.target instanceof HTMLSelectElement)) return;
    const value = event.target.value;
    const mapType = value === 'all' ? 'all' : this.mapTypes.find((type) => type === value);
    if (mapType) this.view.update((view) => ({ ...view, mapType }));
  }

  protected filterFavorites(event: Event): void {
    if (this.blocked() || !(event.target instanceof HTMLInputElement)) return;
    const favoritesOnly = event.target.checked;
    this.view.update((view) => ({ ...view, favoritesOnly }));
  }

  protected sortMaps(event: Event): void {
    if (this.blocked() || !(event.target instanceof HTMLSelectElement)) return;
    const value = event.target.value;
    const sort = this.sortOptions.find((option) => option.value === value)?.value;
    if (sort) this.view.update((view) => ({ ...view, sort }));
  }

  protected clearFilters(): void {
    if (this.blocked()) return;
    this.view.update((view) => ({ ...DEFAULT_LIBRARY_VIEW, sort: view.sort }));
    this.searchInput().nativeElement.focus();
  }

  protected editName(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.name.set(event.target.value);
  }

  protected editRename(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.editDraft.set(event.target.value);
  }

  protected async save(): Promise<void> {
    await this.runStore(async () => {
      const map = this.map();
      let thumbnail: string;
      try {
        thumbnail = createThumbnail(map);
      } catch {
        throw new Error('A thumbnail for this map could not be created. Please try again.');
      }
      const record = await this.store.add(
        map,
        this.name().trim() || defaultMapName(map),
        thumbnail,
      );
      this.name.set('');
      return `Saved “${record.name}”.`;
    });
  }

  protected openMap(record: SavedMap): void {
    this.open.emit(record.map);
  }

  protected startRename(record: SavedMap): void {
    this.editingId.set(record.id);
    this.editDraft.set(record.name);
  }

  protected async commitRename(event: SubmitEvent, record: SavedMap): Promise<void> {
    event.preventDefault();
    await this.runStore(async () => {
      const renamed = await this.store.rename(record.id, this.editDraft());
      this.editingId.set(null);
      return `Renamed to “${renamed.name}”.`;
    });
    this.focusSearchIfHidden(record.id);
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  protected async removeMap(record: SavedMap): Promise<void> {
    await this.runStore(async () => {
      const deleted = await this.store.remove(record.id);
      if (this.editingId() === deleted.id) this.editingId.set(null);
      return this.deletionMessage();
    });
    this.focusSearchIfHidden(record.id);
  }

  protected async undoDelete(): Promise<void> {
    if (this.writeBlocked()) return;
    await this.runStore(async () => {
      const restored = await this.store.undoRemove();
      afterNextRender(
        {
          write: () => {
            if (!this.blocked()) this.searchInput().nativeElement.focus();
          },
        },
        { injector: this.injector },
      );
      const hidden = !this.visibleMaps().some((record) => record.id === restored.id);
      return `Restored “${restored.name}”.${hidden ? ' Current filters hide this map.' : ''}`;
    }, this.undoError);
  }

  protected async duplicateMap(record: SavedMap): Promise<void> {
    await this.runStore(async () => {
      await this.store.duplicate(record.id);
      return `Duplicated “${record.name}”.`;
    });
  }

  protected async toggleFavorite(record: SavedMap): Promise<void> {
    await this.runStore(async () => {
      const favorite = await this.store.toggleFavorite(record.id);
      return favorite ? 'Added to favorites.' : 'Removed from favorites.';
    });
    this.focusSearchIfHidden(record.id);
  }

  private focusSearchIfHidden(id: string): void {
    if (this.visibleMaps().some((record) => record.id === id)) return;
    afterNextRender(
      {
        write: () => {
          if (!this.blocked() && !this.visibleMaps().some((record) => record.id === id))
            this.searchInput().nativeElement.focus();
        },
      },
      { injector: this.injector },
    );
  }

  protected retryLibrary(): void {
    if (this.blocked()) return;
    this.store.reload();
    this.error.set('');
    this.undoError.set('');
    this.notice.set(this.store.problem() ? '' : 'Library reloaded.');
  }

  protected downloadRecovery(): void {
    const raw = this.store.recoveryData();
    if (this.blocked() || raw === null) return;
    try {
      downloadBlob(new Blob([raw], { type: 'text/plain' }), 'encounter-map-forge-recovery.txt');
      this.error.set('');
      this.notice.set('Original library data downloaded.');
    } catch {
      this.notice.set('');
      this.error.set('The recovery data could not be downloaded. Please try again.');
    }
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
      await this.runStore(async () => {
        let text: string;
        try {
          text = await file.text();
        } catch {
          throw new Error('That backup file could not be read.');
        }
        const result = parseBundle(text);
        if (!result.ok) throw new Error(result.error);
        const { added, skipped: duplicateSkips } = await this.store.importMaps(result.maps);
        const skipped = result.skipped + duplicateSkips;
        return skipped > 0
          ? `Imported ${added} ${added === 1 ? 'map' : 'maps'}; ${skipped} ${skipped === 1 ? 'entry' : 'entries'} skipped.`
          : `Imported ${added} ${added === 1 ? 'map' : 'maps'}.`;
      });
    } finally {
      target.value = '';
    }
  }

  private async runStore(action: () => Promise<string>, errorTarget = this.error): Promise<void> {
    if (this.blocked()) return;
    this.working.set(true);
    this.notice.set('');
    this.error.set('');
    this.undoError.set('');
    try {
      this.notice.set(await action());
    } catch (error: unknown) {
      errorTarget.set(
        error instanceof Error
          ? error.message
          : 'This change could not be saved. Please try again.',
      );
    } finally {
      this.working.set(false);
    }
  }
}
