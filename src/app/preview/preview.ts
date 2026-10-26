import { LANDMARK_CATALOG } from '../engine/landmark-catalog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HEIGHT, WIDTH } from '../engine/model';
import type { GeneratedMap } from '../engine/model';
import { renderMap } from '../rendering/render-map';
import { EXPORT_HEIGHT, EXPORT_WIDTH, PIXELS_PER_TILE } from '../rendering/resolution';
import { Icon } from '../icon';

@Component({
  selector: 'forge-preview',
  imports: [Icon],
  templateUrl: './preview.html',
  styleUrl: './preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Preview {
  readonly map = input.required<GeneratedMap>();
  readonly grid = input(true);
  protected readonly zoom = signal(1);
  protected readonly dragging = signal(false);
  protected readonly ariaLabel = computed(() => {
    const m = this.map();
    if (m.type === 'dungeon') {
      return (
        'Dungeon map for seed ' +
        m.seed +
        ', ' +
        m.layout.rooms.length +
        (m.decoration.scene === 'Forgotten study'
          ? ' connected rooms, Forgotten study scene.'
          : ' connected rooms.') +
        (m.decoration.landmark && m.decoration.landmark !== 'None'
          ? ' ' +
            LANDMARK_CATALOG[m.decoration.landmark].label +
            '. ' +
            LANDMARK_CATALOG[m.decoration.landmark].description
          : '') +
        ' Stairs mark the entrance; a circular stone dais marks the objective. Use arrow keys to pan, plus and minus to zoom, Home to fit.'
      );
    }
    return (
      'Forest clearing for seed ' +
      m.seed +
      ', ' +
      m.decoration.character +
      ' character.' +
      (m.decoration.scene === 'Abandoned camp' ? ' Abandoned camp scene.' : '') +
      (m.decoration.landmark && m.decoration.landmark !== 'None'
        ? ' ' +
          LANDMARK_CATALOG[m.decoration.landmark].label +
          '. ' +
          LANDMARK_CATALOG[m.decoration.landmark].description
        : '') +
      ' A path connects two map edges through the clearing. Use arrow keys to pan, plus and minus to zoom, Home to fit.'
    );
  });
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private image: HTMLCanvasElement | undefined;
  private width = 1;
  private height = 1;
  private pan = { x: 0, y: 0 };
  private pointer: { id: number; x: number; y: number } | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      const map = this.map();
      const grid = this.grid();
      this.image = document.createElement('canvas');
      this.image.width = EXPORT_WIDTH;
      this.image.height = EXPORT_HEIGHT;
      const context = this.image.getContext('2d');
      if (context) renderMap(context, map, { grid, pixelsPerTile: PIXELS_PER_TILE });
      untracked(() => this.paint());
    });
    afterNextRender({
      write: () => {
        const observer = new ResizeObserver(() => this.resize());
        observer.observe(this.frame().nativeElement);
        this.resize();
        destroyRef.onDestroy(() => observer.disconnect());
      },
    });
  }

  protected fit(): void {
    this.zoom.set(1);
    this.pan = { x: 0, y: 0 };
    this.paint();
  }

  protected zoomBy(factor: number): void {
    this.zoom.set(Math.max(0.5, Math.min(4, this.zoom() * factor)));
    this.paint();
  }

  protected startPan(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.canvas()?.nativeElement.setPointerCapture(event.pointerId);
    this.dragging.set(true);
  }

  protected movePan(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    this.pan.x += event.clientX - this.pointer.x;
    this.pan.y += event.clientY - this.pointer.y;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.paint();
  }

  protected endPan(event: PointerEvent): void {
    if (this.pointer?.id !== event.pointerId) return;
    this.pointer = undefined;
    this.dragging.set(false);
  }

  protected wheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  protected keyboard(event: KeyboardEvent): void {
    switch (event.key) {
      case '+':
      case '=':
        this.zoomBy(1.25);
        break;
      case '-':
        this.zoomBy(0.8);
        break;
      case 'Home':
        this.fit();
        break;
      case 'ArrowLeft':
        this.pan.x += 40;
        this.paint();
        break;
      case 'ArrowRight':
        this.pan.x -= 40;
        this.paint();
        break;
      case 'ArrowUp':
        this.pan.y += 40;
        this.paint();
        break;
      case 'ArrowDown':
        this.pan.y -= 40;
        this.paint();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private resize(): void {
    const rect = this.frame().nativeElement.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.paint();
  }

  private paint(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.image) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(this.width * dpr);
    canvas.height = Math.round(this.height * dpr);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#15232a';
    context.fillRect(0, 0, this.width, this.height);
    const scale = Math.min(this.width / WIDTH, this.height / HEIGHT) * 0.94 * this.zoom();
    const w = WIDTH * scale;
    const h = HEIGHT * scale;
    this.pan.x = Math.max(-w / 2, Math.min(w / 2, this.pan.x));
    this.pan.y = Math.max(-h / 2, Math.min(h / 2, this.pan.y));
    context.drawImage(
      this.image,
      (this.width - w) / 2 + this.pan.x,
      (this.height - h) / 2 + this.pan.y,
      w,
      h,
    );
  }
}
