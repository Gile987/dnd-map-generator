import type { DungeonDrawing } from '../engine/object-editor/document';
import type { DungeonGroupId } from '../engine/object-editor/dungeon-groups';
import { drawDungeonRitualFloor } from '../rendering/ritual-props';
import { drawStudySurface } from '../rendering/study-surface';
import { viewportTransform, inversePoint } from './viewport-transform';
import type { ReservedArea } from '../engine/feature-reservation';
import { drawDungeonProp } from '../rendering/dungeon-prop-layer';
import { drawProp } from '../rendering/props';
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
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { mapDimensions } from '../engine/model';
import type { Point, Prop, MapDocument } from '../engine/model';
import { renderMap } from '../rendering/render-map';
import { PIXELS_PER_TILE } from '../rendering/resolution';
import { Icon } from '../icon';

export interface EditPointer {
  readonly phase: 'start' | 'move' | 'end' | 'cancel';
  readonly point: Point;
}

@Component({
  selector: 'forge-preview',
  imports: [Icon],
  templateUrl: './preview.html',
  styleUrl: './preview.scss',
  host: {
    '[class.focused]': 'focused()',
    '[class.editing]': 'editMode()',
    '(window:blur)': 'cancelPointer()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Preview {
  readonly map = input.required<MapDocument>();
  readonly editMode = input(false);
  readonly selectedBounds = input<ReservedArea>();
  readonly ghost = input<{
    readonly props: readonly Prop[];
    readonly drawing?: DungeonDrawing;
    readonly groupId?: DungeonGroupId;
    readonly placementAction?: 'place' | 'drop';
    readonly bounds: ReservedArea;
    readonly valid: boolean;
    readonly reason?: string;
  }>();
  readonly editPointer = output<EditPointer>();
  readonly editCancel = output<void>();
  readonly editNudge = output<Point>();
  readonly editCommit = output<void>();
  readonly grid = input(true);
  readonly showSecrets = input(false);
  readonly focused = input(false);
  protected readonly zoom = signal(1);
  protected readonly dragging = signal(false);
  protected readonly ariaLabel = computed(() => {
    const m = this.map();
    const navigation = this.editMode()
      ? 'Edit objects. Select an object on the map or from Objects on this map. Arrow keys position the selection, Enter places it, Escape cancels. Switch to Explore to pan. Plus and minus zoom; Home fits.'
      : 'Use arrow keys to pan, plus and minus to zoom, Home to fit.';
    if (m.type === 'tower')
      return `Tower map for seed ${m.seed}. ${m.layout.floors.length} numbered floors. Matching stair letters connect floors.${m.decoration.laboratoryFloor !== undefined && (this.showSecrets() || !m.layout.floors.find((f) => f.number === m.decoration.laboratoryFloor)?.secret) ? ' An alchemist’s laboratory occupies floor ' + m.decoration.laboratoryFloor + '. Its cauldron, desk and bookshelf each block one square.' : ''}${m.decoration.observatoryFloor !== undefined && (this.showSecrets() || !m.layout.floors.find((f) => f.number === m.decoration.observatoryFloor)?.secret) ? ' An observatory occupies floor ' + m.decoration.observatoryFloor + '. Its telescope, chart table and cabinet each block one square.' : ''}${m.layout.portalFloor !== null ? (this.showSecrets() ? ' One portal pair leads to a secret floor.' : ' Secret chamber and portal omitted from the image.') : ''} ${navigation}`;
    if (m.type === 'courtyard')
      return `Ruined courtyard map for seed ${m.seed}. Four broad openings connect walkable grass to a paved interior. Standing walls and columns block movement; flat rubble is passable. A six-by-six gathering space stays clear.${m.decoration.fountain ? ' A dry fountain blocks three by three tiles, with a clear tile around it.' : ''}${m.decoration.wagon ? ' A collapsed wagon blocks three by two squares, or two by three when rotated. A spilled crate blocks one square; its detached wheel and loose goods are passable.' : ''} ${navigation}`;
    if (m.type === 'dungeon') {
      return (
        (m.objectEdits ? 'Customized dungeon map for seed ' : 'Dungeon map for seed ') +
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
        (m.decoration.furniture === 'dining-table'
          ? ' A dining table blocks two tiles, with clear space around it.'
          : '') +
        (m.decoration.ritual
          ? ' A ritual site has a one-tile blocking altar, decorative candles and offerings, and passable floor markings.'
          : '') +
        ' Stairs mark the entrance; a circular stone dais marks the objective. ' +
        navigation
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
      (m.decoration.fallenTree
        ? ' A fallen ancient tree has a four-square blocking trunk and one blocking root mass; branches and mushrooms are passable.'
        : '') +
      ' A path connects two map edges through the clearing. ' +
      navigation
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
      const showSecrets = this.showSecrets();
      const { width, height } = mapDimensions(map);
      this.image = document.createElement('canvas');
      this.image.width = width * PIXELS_PER_TILE;
      this.image.height = height * PIXELS_PER_TILE;
      const context = this.image.getContext('2d');
      if (context) renderMap(context, map, { grid, pixelsPerTile: PIXELS_PER_TILE, showSecrets });
      untracked(() => this.paint());
    });
    effect(() => {
      this.selectedBounds();
      this.ghost();
      this.editMode();
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
    this.panBy(0, 0);
  }

  protected startPan(event: PointerEvent): void {
    if (event.button !== 0 || this.pointer) return;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.canvas()?.nativeElement.setPointerCapture(event.pointerId);
    if (this.editMode()) this.emitEditPointer('start', event);
    else this.dragging.set(true);
  }

  protected movePan(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    if (this.editMode()) {
      this.emitEditPointer('move', event);
      return;
    }
    this.panBy(event.clientX - this.pointer.x, event.clientY - this.pointer.y);
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  protected endPan(event: PointerEvent): void {
    if (this.pointer?.id !== event.pointerId) return;
    this.pointer = undefined;
    this.dragging.set(false);
    if (this.editMode()) this.emitEditPointer(event.type === 'pointerup' ? 'end' : 'cancel', event);
  }

  protected cancelPointer(): void {
    this.pointer = undefined;
    this.dragging.set(false);
    this.editCancel.emit();
  }

  protected wheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  protected keyboard(event: KeyboardEvent): void {
    if (this.editMode()) {
      const directions: Record<string, Point> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      if (event.key === 'Escape' || event.key === 'Enter' || directions[event.key]) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') this.editCancel.emit();
        else if (event.key === 'Enter') this.editCommit.emit();
        else {
          const direction = directions[event.key];
          if (direction) this.editNudge.emit(direction);
        }
        return;
      }
    }
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
        this.panBy(40, 0);
        break;
      case 'ArrowRight':
        this.panBy(-40, 0);
        break;
      case 'ArrowUp':
        this.panBy(0, 40);
        break;
      case 'ArrowDown':
        this.panBy(0, -40);
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

  private panBy(x: number, y: number): void {
    const { width: columns, height: rows } = mapDimensions(this.map());
    const scale = Math.min(this.width / columns, this.height / rows) * 0.94 * this.zoom();
    const limitX = (columns * scale) / 2;
    const limitY = (rows * scale) / 2;
    const clamp = (offset: number, limit: number) => Math.max(-limit, Math.min(limit, offset));
    this.pan = {
      x: clamp(clamp(this.pan.x, limitX) + x, limitX),
      y: clamp(clamp(this.pan.y, limitY) + y, limitY),
    };
    this.paint();
  }

  private paint(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.image) return;
    const dpr = window.devicePixelRatio || 1;
    const bitmapWidth = Math.round(this.width * dpr),
      bitmapHeight = Math.round(this.height * dpr);
    if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
    if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#15232a';
    context.fillRect(0, 0, this.width, this.height);
    const { width: columns, height: rows } = mapDimensions(this.map());
    const transform = viewportTransform(
      this.width,
      this.height,
      columns,
      rows,
      this.zoom(),
      this.pan,
    );
    context.drawImage(this.image, transform.x, transform.y, transform.width, transform.height);
    if (this.editMode()) {
      context.save();
      context.translate(transform.x, transform.y);
      context.scale(transform.scale, transform.scale);
      const selected = this.selectedBounds(),
        ghost = this.ghost();
      if (selected) {
        const bounds = selected;
        context.strokeStyle = '#f0d585';
        context.lineWidth = 2 / transform.scale;
        context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }
      if (ghost && Number.isFinite(ghost.bounds.x) && Number.isFinite(ghost.bounds.y)) {
        const bounds = ghost.bounds;
        context.globalAlpha = 0.7;
        if (ghost.drawing && ghost.groupId === 'ritual')
          drawDungeonRitualFloor(context, ghost.drawing);
        if (ghost.drawing && ghost.groupId === 'study') drawStudySurface(context, ghost.drawing);
        for (const prop of ghost.props) {
          const map = this.map();
          if (map.type === 'dungeon') drawDungeonProp(context, prop, ghost.drawing ?? map);
          else drawProp(context, prop);
        }
        context.globalAlpha = 1;
        context.fillStyle = ghost.valid ? '#6fda9144' : '#ef787855';
        context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        context.strokeStyle = ghost.valid ? '#8ceca2' : '#ffa39a';
        context.lineWidth = 2 / transform.scale;
        context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }
      context.restore();
    }
  }

  clientMapPoint(clientX: number, clientY: number): Point | undefined {
    const rect = this.frame().nativeElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientY < rect.top ||
      clientX >= rect.right ||
      clientY >= rect.bottom
    )
      return undefined;
    const { width, height } = mapDimensions(this.map());
    return inversePoint(
      viewportTransform(this.width, this.height, width, height, this.zoom(), this.pan),
      { x: clientX - rect.left, y: clientY - rect.top },
    );
  }

  private emitEditPointer(phase: EditPointer['phase'], event: PointerEvent): void {
    const point = this.clientMapPoint(event.clientX, event.clientY);
    this.editPointer.emit({ phase: point ? phase : 'cancel', point: point ?? { x: -1, y: -1 } });
  }
}
