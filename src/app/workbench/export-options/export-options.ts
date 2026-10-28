import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { GeneratedMap } from '../../engine/model';
import { downloadBlob } from '../../browser/download';
import { configuredExportFilename, createPng } from '../../rendering/export';
import { HEIGHT, WIDTH } from '../../engine/model';
import { EXPORT_PRESETS, exportDimensions } from '../../rendering/export-presets';
import type { ExportPreset } from '../../rendering/export-presets';
import { Icon } from '../../icon';
import { MAP_TYPE_LABELS } from '../presentation';

type PreviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready';
      readonly map: GeneratedMap;
      readonly grid: boolean;
      readonly opacity: number;
      readonly preset: ExportPreset;
      readonly blob: Blob;
      readonly url: string;
    };

@Component({
  selector: 'forge-export-options',
  imports: [Icon],
  templateUrl: './export-options.html',
  styleUrl: './export-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportOptions {
  readonly map = input.required<GeneratedMap>();
  readonly disabled = input(false);
  readonly downloaded = output<void>();
  protected readonly snapshot = signal<GeneratedMap | null>(null);
  protected readonly grid = signal(true);
  protected readonly opacity = signal(15);
  protected readonly presets = EXPORT_PRESETS;
  protected readonly preset = signal<ExportPreset>(EXPORT_PRESETS[0]);
  protected readonly columns = WIDTH;
  protected readonly rows = HEIGHT;
  protected readonly size = computed(() => exportDimensions(this.preset().pixelsPerTile));
  protected readonly preview = signal<PreviewState>({ kind: 'loading' });
  protected readonly notice = signal('');
  protected readonly downloadError = signal('');
  protected readonly dimensions = computed(() => `${this.size().width} × ${this.size().height} px`);
  protected readonly mapLabels = MAP_TYPE_LABELS;
  private readonly retry = signal(0);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly title = viewChild.required<ElementRef<HTMLHeadingElement>>('title');
  protected readonly ready = computed(() => {
    const preview = this.preview();
    return preview.kind === 'ready' &&
      preview.map === this.snapshot() &&
      preview.grid === this.grid() &&
      preview.opacity === this.opacity() &&
      preview.preset === this.preset()
      ? preview
      : null;
  });

  constructor() {
    effect((onCleanup) => {
      const map = this.snapshot();
      const grid = this.grid();
      const opacity = this.opacity();
      const preset = this.preset();
      this.retry();
      this.preview.set({ kind: 'loading' });
      this.notice.set('');
      this.downloadError.set('');
      if (!map) return;
      let active = true;
      let url: string | undefined;
      let secondFrame = 0;
      // Let the dialog/loading state paint, and coalesce rapid slider changes.
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(async () => {
          try {
            const blob = await createPng(map, grid, opacity / 100, preset.pixelsPerTile);
            if (!active) return;
            url = URL.createObjectURL(blob);
            this.preview.set({ kind: 'ready', map, grid, opacity, preset, blob, url });
          } catch (error: unknown) {
            if (active)
              this.preview.set({
                kind: 'error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'The export preview could not be created.',
              });
          }
        });
      });
      onCleanup(() => {
        active = false;
        cancelAnimationFrame(firstFrame);
        cancelAnimationFrame(secondFrame);
        if (url) URL.revokeObjectURL(url);
      });
    });
  }

  show(): void {
    if (this.disabled() || this.dialog().nativeElement.open) return;
    this.snapshot.set(this.map());
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected closed(): void {
    this.snapshot.set(null);
  }

  protected changeGrid(event: Event): void {
    if (!this.disabled() && event.target instanceof HTMLInputElement)
      this.grid.set(event.target.checked);
  }

  protected changePreset(event: Event): void {
    if (this.disabled() || !(event.target instanceof HTMLSelectElement)) return;
    const value = event.target.value;
    const preset = EXPORT_PRESETS.find((option) => option.id === value);
    if (!preset || preset === this.preset()) return;
    this.preset.set(preset);
    this.grid.set(preset.grid);
  }

  protected changeOpacity(event: Event): void {
    if (this.disabled() || !this.grid() || !(event.target instanceof HTMLInputElement)) return;
    const value = event.target.valueAsNumber;
    if (Number.isInteger(value) && value >= 0 && value <= 100) this.opacity.set(value);
  }

  protected retryPreview(): void {
    this.title().nativeElement.focus();
    this.preview.set({ kind: 'loading' });
    this.retry.update((value) => value + 1);
  }

  protected download(): void {
    const preview = this.ready();
    if (this.disabled() || !preview) return;
    this.downloadError.set('');
    this.notice.set('');
    try {
      downloadBlob(
        preview.blob,
        configuredExportFilename(preview.map, preview.grid, preview.opacity, preview.preset),
      );
      this.notice.set('PNG ready. Check your downloads.');
      this.downloaded.emit();
    } catch (error: unknown) {
      this.downloadError.set(
        error instanceof Error
          ? error.message
          : 'The PNG could not be downloaded. Please try again.',
      );
    }
  }
}
