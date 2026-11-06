import { drawFootprintOutline } from '../rendering/footprint-outline';
import { drawTowerStaircase } from '../rendering/tower-renderer';
import type { StairLanding } from '../engine/tower-landings';
import type { TowerStairStyle } from '../engine/tower';
import { placeLayerLabels } from '../rendering/layer-label-layout';
import type { EditorDrawing } from '../rendering/editor-prop';
import { drawEditorProp } from '../rendering/editor-prop';
import { isEditableMap, resolveEditorMap } from '../engine/object-editor/editor-view';
import { drawDungeonRitualFloor } from '../rendering/ritual-props';
import { drawStudySurface } from '../rendering/study-surface';
import { drawForestCampAsh } from '../rendering/forest-surface';
import { viewportTransform, inversePoint, areaViewport } from './viewport-transform';
import type { FootprintShape, ReservedArea } from '../engine/feature-reservation';
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

export interface ExplorePoint {
  readonly source: MapDocument;
  readonly point?: Point;
  readonly padding: number;
}
export interface ExploreClick extends ExplorePoint {
  readonly point: Point;
  readonly start: Point;
}

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
  readonly exploreHint = input('');
  readonly exploreClickable = input(false);
  readonly exploreTarget = input<{ readonly bounds: ReservedArea; readonly label: string }>();
  readonly exploreHover = output<ExplorePoint>();
  readonly exploreClick = output<ExploreClick>();
  readonly layerBadges = input<
    readonly {
      readonly id: string;
      readonly text: string;
      readonly label: string;
      readonly bounds: ReservedArea;
    }[]
  >([]);
  readonly activeLayer = input('');
  readonly layerInspect = output<string>();
  protected readonly badges = signal<
    readonly { id: string; text: string; width: number; label: string; x: number; y: number }[]
  >([]);
  readonly selectedBounds = input<ReservedArea>();
  readonly selectedFootprint = input<readonly FootprintShape[]>();
  readonly editingBounds = input<ReservedArea>();
  readonly ghost = input<{
    readonly props: readonly Prop[];
    readonly staircase?: { readonly landing: StairLanding; readonly style: TowerStairStyle };
    readonly drawing?: EditorDrawing;
    readonly groupId?: string;
    readonly placementAction?: 'place' | 'drop';
    readonly bounds: ReservedArea;
    readonly footprint?: readonly FootprintShape[];
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
      : 'Use arrow keys to pan, plus and minus to zoom, Home to fit. ' + this.exploreHint();
    if (m.type === 'tower')
      return `Tower map for seed ${m.seed}. ${m.layout.floors.length} numbered floors. Matching stair letters connect floors.${m.decoration.laboratoryFloor !== undefined && (this.showSecrets() || !m.layout.floors.find((f) => f.number === m.decoration.laboratoryFloor)?.secret) ? ' An alchemist’s laboratory occupies floor ' + m.decoration.laboratoryFloor + '. Its cauldron, desk and bookshelf each block one square.' : ''}${m.decoration.observatoryFloor !== undefined && (this.showSecrets() || !m.layout.floors.find((f) => f.number === m.decoration.observatoryFloor)?.secret) ? ' An observatory occupies floor ' + m.decoration.observatoryFloor + '. Its telescope, chart table and cabinet each block one square.' : ''}${m.layout.portalFloor !== null ? (this.showSecrets() ? ' One portal pair leads to a secret floor.' : ' Secret chamber and portal omitted from the image.') : ''} ${navigation}`;
    if (m.type === 'courtyard')
      return `${m.objectEdits ? 'Customized ruined courtyard' : 'Ruined courtyard'} map for seed ${m.seed}. Four broad openings connect walkable grass to a paved interior. Standing walls and columns block movement; flat rubble is passable. A six-by-six gathering space stays clear.${m.decoration.fountain ? ' A dry fountain blocks three by three tiles, with a clear tile around it.' : ''}${m.decoration.wagon ? ' A collapsed wagon blocks three by two squares, or two by three when rotated. A spilled crate blocks one square; its detached wheel and loose goods are passable.' : ''} ${navigation}`;
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
      (m.objectEdits ? 'Customized forest clearing for seed ' : 'Forest clearing for seed ') +
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
  private pointer:
    | {
        id: number;
        x: number;
        y: number;
        startX: number;
        startY: number;
        dragged: boolean;
        source: MapDocument;
        clickable: boolean;
        start?: Point;
      }
    | undefined;

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
      this.layerBadges();
      this.selectedBounds();
      this.editingBounds();
      this.ghost();
      this.selectedFootprint();
      this.editMode();
      this.exploreTarget();
      untracked(() => this.paint());
    });
    effect(() => {
      this.editMode();
      this.exploreClickable();
      untracked(() => this.cancelPointer());
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

  focusArea(area: ReservedArea): void {
    this.cancelPointer();
    const { width, height } = mapDimensions(this.map());
    const view = areaViewport(this.width, this.height, width, height, area);
    this.zoom.set(view.zoom);
    this.pan = view.pan;
    this.paint();
  }

  protected fit(): void {
    this.leave();
    this.zoom.set(1);
    this.pan = { x: 0, y: 0 };
    this.paint();
  }

  protected zoomBy(factor: number): void {
    this.zoom.set(Math.max(0.5, Math.min(4, this.zoom() * factor)));
    this.panBy(0, 0);
  }

  protected startPan(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.pointer) {
      if (this.pointer.id !== event.pointerId) this.cancelPointer();
      return;
    }
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
      source: this.map(),
      clickable: this.exploreClickable(),
      start: this.clientMapPoint(event.clientX, event.clientY),
    };
    this.canvas()?.nativeElement.setPointerCapture(event.pointerId);
    if (this.editMode()) this.emitEditPointer('start', event);
  }

  protected movePan(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer) {
      if (!this.editMode())
        this.exploreHover.emit({
          source: this.map(),
          point: this.clientMapPoint(event.clientX, event.clientY),
          padding: this.hitPadding(),
        });
      return;
    }
    if (event.pointerId !== pointer.id) return;
    if (pointer.source !== this.map()) {
      this.cancelPointer();
      return;
    }
    if (this.editMode()) {
      this.emitEditPointer('move', event);
      return;
    }
    const dragged =
      pointer.dragged ||
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5;
    if (dragged) {
      this.dragging.set(true);
      this.panBy(
        event.clientX - (pointer.dragged ? pointer.x : pointer.startX),
        event.clientY - (pointer.dragged ? pointer.y : pointer.startY),
      );
      this.exploreHover.emit({ source: this.map(), padding: this.hitPadding() });
    }
    this.pointer = { ...pointer, x: event.clientX, y: event.clientY, dragged };
  }

  protected endPan(event: PointerEvent): void {
    const pointer = this.pointer;
    if (pointer?.id !== event.pointerId) return;
    this.pointer = undefined;
    this.dragging.set(false);
    if (this.editMode()) this.emitEditPointer(event.type === 'pointerup' ? 'end' : 'cancel', event);
    else if (
      event.type === 'pointerup' &&
      !pointer.dragged &&
      pointer.clickable &&
      this.exploreClickable() &&
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= 5 &&
      pointer.source === this.map() &&
      pointer.start
    ) {
      const point = this.clientMapPoint(event.clientX, event.clientY);
      if (point)
        this.exploreClick.emit({
          source: pointer.source,
          point,
          start: pointer.start,
          padding: this.hitPadding(),
        });
    }
  }
  protected leave(): void {
    this.exploreHover.emit({ source: this.map(), padding: this.hitPadding() });
  }
  private hitPadding(): number {
    const { width, height } = mapDimensions(this.map());
    return Math.max(
      0.35,
      6 / viewportTransform(this.width, this.height, width, height, this.zoom(), this.pan).scale,
    );
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
    this.leave();
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
    const visible = this.layerBadges().flatMap((badge) => {
      const x = transform.x + (badge.bounds.x + badge.bounds.width / 2) * transform.scale;
      const y = transform.y + badge.bounds.y * transform.scale;
      return x >= 0 && x <= this.width && y >= 0 && y <= this.height ? [{ ...badge, x, y }] : [];
    });
    context.font = '600 10px system-ui';
    const labelWidth = Math.min(
      this.width - 12,
      Math.max(
        96,
        ...visible.map((badge) => Math.ceil(context.measureText(badge.text).width) + 18),
      ),
    );
    const labels = placeLayerLabels(visible, this.width, this.height, labelWidth, 28, 6);
    this.badges.set(
      labels.flatMap((label) => {
        const badge = visible.find((badge) => badge.id === label.id);
        return badge
          ? [
              {
                id: badge.id,
                text: badge.text,
                label: badge.label,
                width: labelWidth,
                x: label.x,
                y: label.y,
              },
            ]
          : [];
      }),
    );
    context.strokeStyle = '#d0c68a99';
    context.lineWidth = 1;
    for (const label of labels) {
      context.beginPath();
      context.moveTo(label.anchorX, label.anchorY);
      context.lineTo(label.x, label.y);
      context.stroke();
    }
    const target = this.exploreTarget();
    if (!this.editMode() && target) {
      context.save();
      context.translate(transform.x, transform.y);
      context.scale(transform.scale, transform.scale);
      context.strokeStyle = '#f0d585';
      context.lineWidth = 2 / transform.scale;
      const b = target.bounds;
      context.strokeRect(b.x, b.y, b.width, b.height);
      context.restore();
    }
    if (this.editMode() || this.selectedBounds()) {
      context.save();
      context.translate(transform.x, transform.y);
      context.scale(transform.scale, transform.scale);
      const editingBounds = this.editingBounds();
      if (editingBounds && this.editMode()) {
        context.save();
        context.strokeStyle = '#8dd3df';
        context.lineWidth = 2 / transform.scale;
        context.setLineDash([0.22, 0.16]);
        context.strokeRect(
          editingBounds.x,
          editingBounds.y,
          editingBounds.width,
          editingBounds.height,
        );
        context.restore();
      }
      const selected = this.selectedBounds(),
        ghost = this.ghost();
      if (selected) {
        const bounds = selected;
        context.strokeStyle = '#f0d585';
        context.lineWidth = 2 / transform.scale;
        const footprint = this.selectedFootprint();
        if (footprint) drawFootprintOutline(context, footprint);
        else context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }
      if (ghost && Number.isFinite(ghost.bounds.x) && Number.isFinite(ghost.bounds.y)) {
        const bounds = ghost.bounds;
        context.globalAlpha = 0.7;
        if (ghost.drawing?.type === 'dungeon' && ghost.groupId === 'ritual')
          drawDungeonRitualFloor(context, ghost.drawing);
        if (ghost.drawing?.type === 'dungeon' && ghost.groupId === 'study')
          drawStudySurface(context, ghost.drawing);
        if (ghost.drawing?.type === 'forest' && ghost.groupId === 'camp')
          drawForestCampAsh(context, ghost.drawing);
        if (ghost.staircase)
          drawTowerStaircase(context, ghost.staircase.landing, ghost.staircase.style);
        for (const prop of ghost.props) {
          const map = this.map();
          if (isEditableMap(map))
            drawEditorProp(context, prop, ghost.drawing ?? resolveEditorMap(map));
          else drawProp(context, prop);
        }
        context.globalAlpha = 1;
        context.fillStyle = ghost.valid ? '#6fda9144' : '#ef787855';
        context.strokeStyle = ghost.valid ? '#8ceca2' : '#ffa39a';
        context.lineWidth = 2 / transform.scale;
        if (ghost.footprint) drawFootprintOutline(context, ghost.footprint, true);
        else {
          context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
          context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }
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
