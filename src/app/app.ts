import {
  ChangeDetectionStrategy,
  Component,
  computed,
  afterNextRender,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import type { GeneratedMap, MapType } from './engine/model';
import { downloadPng } from './rendering/export';
import { mapDimensions } from './engine/model';
import { PIXELS_PER_TILE } from './rendering/resolution';
import { Icon } from './icon';
import { Library } from './save/library';
import { MapPanel } from './workbench/map-panel/map-panel';
import { SettingsPanel } from './workbench/settings-panel/settings-panel';
import { WorkbenchSession } from './workbench/workbench-session';
import { ExportOptions } from './workbench/export-options/export-options';
import type { DraftChange } from './workbench/settings-draft';
import type { Candidate } from './workbench/workbench-session';

type Operation = 'generation' | 'details' | 'export';

function yieldForUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

@Component({
  selector: 'app-root',
  imports: [Icon, Library, MapPanel, SettingsPanel, ExportOptions],
  providers: [WorkbenchSession],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.map-focused]': 'focused()',
    '(keydown.escape)': 'escapeFocus($event)',
  },
})
export class App {
  private readonly session = inject(WorkbenchSession);
  private readonly injector = inject(Injector);
  private readonly mapPanel = viewChild.required(MapPanel);
  private workbenchScroll = { x: 0, y: 0 };
  private readonly mapType = this.session.mapType;
  protected readonly map = this.session.map;
  protected readonly currentMap = this.session.currentMap;
  protected readonly comparison = this.session.comparison;
  protected readonly draft = this.session.draft;
  protected readonly pending = this.session.pending;
  protected readonly generationEffect = this.session.generationEffect;
  protected readonly shuffleHistory = this.session.shuffleHistory;
  protected readonly grid = signal(true);
  protected readonly showSecrets = signal(false);
  protected readonly focused = signal(false);
  protected readonly busy = signal<Operation | null>(null);
  protected readonly error = signal('');
  protected readonly status = signal('Your dungeon is ready.');
  protected readonly attempted = signal(false);
  protected readonly exportSize = computed(() => {
    const { width, height } = mapDimensions(this.map());
    return `${width * PIXELS_PER_TILE} × ${height * PIXELS_PER_TILE} px`;
  });

  protected pinCurrent(): void {
    if (this.busy() || this.comparison().selected === 'pinned') return;
    this.session.pinCurrent();
    this.status.set(
      'Current map pinned for this session. Generate or Shuffle to explore another candidate.',
    );
  }

  protected selectCandidate(candidate: Candidate): void {
    if (this.busy()) return;
    this.session.selectCandidate(candidate);
    this.status.set(
      `Showing ${this.comparison().selected === 'pinned' ? 'Pinned' : 'Current'}. Save and Export use this candidate.`,
    );
  }

  protected clearPin(): void {
    if (this.busy()) return;
    this.session.clearPin();
    this.status.set('Pin cleared. Showing Current. Your library is unchanged.');
    afterNextRender(() => this.mapPanel().focusPinControl(), { injector: this.injector });
  }

  protected setFocused(focused: boolean): void {
    if (focused === this.focused()) return;
    if (focused) this.workbenchScroll = { x: window.scrollX, y: window.scrollY };
    this.focused.set(focused);
    afterNextRender(
      {
        write: () => {
          this.mapPanel().focusViewControl();
          window.scrollTo({
            left: focused ? 0 : this.workbenchScroll.x,
            top: focused ? 0 : this.workbenchScroll.y,
            behavior: 'instant',
          });
        },
      },
      { injector: this.injector },
    );
  }

  protected escapeFocus(event: Event): void {
    if (
      !this.focused() ||
      event.defaultPrevented ||
      (event.target instanceof Element && event.target.closest('dialog[open]'))
    )
      return;
    event.preventDefault();
    this.setFocused(false);
  }

  protected async selectMapType(type: MapType): Promise<void> {
    if (this.busy()) return;
    if (type === this.mapType()) return;
    await this.run('generation', () => {
      this.session.selectMapType(type);
      if (type === 'tower') {
        this.status.set('Tower restored. Follow the matching floor connections.');
      } else if (type === 'courtyard') {
        this.status.set('Ruined courtyard restored. Four open approaches await.');
      } else if (type === 'forest') {
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
      type: this.mapType(),
      changes: {
        seed: `${this.mapType()}-${Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('')}`,
      },
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
      if (!this.session.shuffle())
        throw new Error('Those details could not be shuffled. Your displayed map is unchanged.');
      this.status.set(
        this.map().type === 'tower'
          ? 'Details shuffled. Floors, connections, and stonework are preserved.'
          : this.map().type === 'courtyard'
            ? 'Details shuffled. Courtyard walls, approaches, and paving are preserved.'
            : this.map().type === 'dungeon'
              ? 'Details shuffled. Your layout and floor texture are preserved.'
              : 'Details shuffled. The clearing layout is preserved.',
      );
    });
  }

  protected async restoreShuffle(direction: 'undo' | 'redo'): Promise<void> {
    if (this.busy() || this.shuffleHistory()[direction] === 0) return;
    await this.run('details', () => {
      if (direction === 'undo') this.session.undoShuffle();
      else this.session.redoShuffle();
      this.status.set(
        `Shuffle ${direction === 'undo' ? 'undone' : 'redone'}. Showing detail revision ${this.map().decoration.revision}.`,
      );
    });
  }

  protected openSaved(map: GeneratedMap): void {
    if (this.busy()) return;
    this.session.openSaved(map);
    this.attempted.set(false);
    this.error.set('');
    this.status.set(
      map.type === 'tower'
        ? 'Tower opened from your library.'
        : map.type === 'courtyard'
          ? 'Courtyard opened from your library.'
          : map.type === 'dungeon'
            ? 'Map opened from your library.'
            : 'Clearing opened from your library.',
    );
  }

  protected async export(): Promise<void> {
    await this.run('export', async () => {
      await downloadPng(this.map(), this.grid(), this.showSecrets());
      this.exportReady();
    });
  }

  protected exportReady(): void {
    this.error.set('');
    this.status.set(
      `Your ${this.exportSize().replace(' px', '')} PNG is ready. Check your downloads.`,
    );
  }

  protected updateDraft(change: DraftChange): void {
    if (this.busy()) return;
    this.session.updateDraft(change);
    this.attempted.set(false);
    this.error.set('');
  }

  protected async generate(): Promise<void> {
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
          ? this.mapType() === 'tower'
            ? 'A new tower is ready. Follow the floor connections.'
            : this.mapType() === 'courtyard'
              ? 'A new ruined courtyard is ready.'
              : this.mapType() === 'dungeon'
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
