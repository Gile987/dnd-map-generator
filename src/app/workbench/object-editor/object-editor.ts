import type { ForestCharacter } from '../../engine/model';
import { describeObjectLayer } from '../../rendering/dungeon-layer-description';
import { doorIsOpen, dungeonDoorAt, dungeonDoors } from '../../engine/dungeon-doors';
import type { DoorToggleRequest } from '../../engine/dungeon-doors';
import type { ExploreClick, ExplorePoint } from '../../preview/preview';
import {
  editorInstances,
  editorSelections,
  editorOrderedObjects,
  editorOverlaps,
  editorOrderStep,
  editorObjectLabel,
  editorPalette,
  resolveEditorMap,
} from '../../engine/object-editor/editor-view';
import type { EditorSelection } from '../../engine/object-editor/editor-view';
import {
  afterNextRender,
  ElementRef,
  inject,
  Injector,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isBlockingProp } from '../../engine/model';
import type { EditableMapDocument, MapDocument, Point, PropKind } from '../../engine/model';
import { quarterTurn } from '../../engine/object-editor/group-rotation';
import {
  applyEditorCommand,
  proposeEditorCommand,
} from '../../engine/object-editor/editor-commands';
import type { ObjectCommand } from '../../engine/object-editor/commands';
import { areaContains } from '../../engine/feature-reservation';
import { authoredObjectArea } from '../../engine/object-editor/object-geometry';
import { Preview } from '../../preview/preview';
import type { EditPointer } from '../../preview/preview';
import { ObjectArtwork } from './object-artwork';

export interface ObjectEditRequest {
  readonly source: MapDocument;
  readonly command: ObjectCommand;
}
interface Placement {
  readonly source: EditableMapDocument;
  readonly command: Extract<ObjectCommand, { readonly target: Point }>;
}

@Component({
  selector: 'forge-object-editor',
  imports: [Preview, ObjectArtwork],
  templateUrl: './object-editor.html',
  styleUrl: './object-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.focused]': 'focused() && !editing()',
    '(document:pointermove)': 'paletteMove($event)',
    '(document:pointerup)': 'paletteEnd($event)',
    '(document:pointercancel)': 'paletteCancel($event)',
    '(keydown.escape)': 'escape($event)',
  },
})
export class ObjectEditor {
  readonly map = input.required<EditableMapDocument>();
  readonly grid = input(true);
  readonly focused = input(false);
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly changed = output<ObjectEditRequest>();
  readonly doorToggleRequested = output<DoorToggleRequest>();
  readonly editingChanged = output<boolean>();
  readonly history = input({ undo: 0, redo: 0, limit: 20 });
  readonly historyRequested = output<'undo' | 'redo'>();
  private readonly doorMap = computed(() => {
    const map = this.map();
    return map.type === 'dungeon' ? map : undefined;
  });
  protected readonly doors = computed(() => {
    const map = this.doorMap();
    return map ? dungeonDoors(map.layout) : [];
  });
  protected readonly openDoorCount = computed(() => this.doorMap()?.doorStates?.open.length ?? 0);
  protected readonly chosenDoorId = signal('');
  protected readonly chosenDoor = computed(
    () => this.doors().find((door) => door.id === this.chosenDoorId()) ?? this.doors()[0],
  );
  protected readonly chosenDoorOpen = computed(() => {
    const door = this.chosenDoor(),
      map = this.doorMap();
    return !!door && !!map && doorIsOpen(map, door.id);
  });
  private readonly hoveredDoor = signal<{ source: MapDocument; id: string } | undefined>(undefined);
  protected readonly doorTarget = computed(() => {
    const hover = this.hoveredDoor(),
      map = this.doorMap();
    if (
      !map ||
      this.editing() ||
      this.disabled() ||
      this.readOnly() ||
      !hover ||
      hover.source.type !== 'dungeon' ||
      hover.source.layout !== map.layout
    )
      return undefined;
    const door = this.doors().find((d) => d.id === hover.id)?.threshold;
    if (!door) return undefined;
    return {
      label: doorIsOpen(map, hover.id) ? 'Close door' : 'Open door',
      bounds:
        door.axis === 'horizontal'
          ? { x: door.x, y: door.y - 0.3, width: door.span, height: 0.6 }
          : { x: door.x - 0.3, y: door.y, width: 0.6, height: door.span },
    };
  });
  protected doorHover(event: ExplorePoint): void {
    const map = this.doorMap();
    const id =
      map &&
      !this.editing() &&
      !this.disabled() &&
      !this.readOnly() &&
      event.source === map &&
      event.point
        ? dungeonDoorAt(map.layout, event.point, event.padding)
        : undefined;
    this.hoveredDoor.set(id ? { source: event.source, id } : undefined);
  }
  protected doorClick(event: ExploreClick): void {
    const map = this.doorMap();
    if (!map || this.editing() || this.disabled() || this.readOnly() || event.source !== map)
      return;
    const id = dungeonDoorAt(map.layout, event.point, event.padding);
    if (id && id === dungeonDoorAt(map.layout, event.start, event.padding))
      this.doorToggleRequested.emit({ source: map, id });
  }
  protected toggleChosenDoor(): void {
    const door = this.chosenDoor(),
      map = this.doorMap();
    if (map && door && !this.editing() && !this.disabled() && !this.readOnly())
      this.doorToggleRequested.emit({ source: map, id: door.id });
  }
  protected isDoorOpen(id: string): boolean {
    const map = this.doorMap();
    return !!map && doorIsOpen(map, id);
  }
  protected readonly editing = signal(false);
  readonly isEditing = computed(() => this.editing() && !this.readOnly());
  protected readonly active = computed(
    () => this.editing() && !this.disabled() && !this.readOnly(),
  );
  protected readonly paletteOpen = signal(false);
  protected readonly query = signal('');
  protected readonly selected = signal('');
  protected readonly placement = signal<Placement | undefined>(undefined);
  protected readonly message = signal('');
  protected readonly instances = computed(() => editorSelections(this.map()));
  protected readonly selection = computed(() =>
    this.instances().find((item) => item.id === this.selected()),
  );
  protected readonly ordered = computed(() => editorOrderedObjects(this.map()));
  protected readonly overlaps = computed(() => editorOverlaps(this.map()));
  protected readonly layerId = signal('');
  protected readonly layerInfo = computed(() => {
    const overlap = this.overlaps().find((item) => item.id === this.layerId());
    if (!overlap) return undefined;
    const ids = [overlap.id, ...[...overlap.underneath].reverse()];
    return ids.flatMap((id) => {
      const item = this.ordered().find((item) => item.id === id);
      const unit = this.instances().find((unit) => unit.members.includes(id));
      return item && unit
        ? [
            {
              id,
              selectionId: unit.id,
              label: editorObjectLabel(this.map(), item.prop.kind),
              position: item.prop,
              area: authoredObjectArea(item.prop),
              group: unit.groupId ? unit.label : undefined,
            },
          ]
        : [];
    });
  });
  protected readonly layerBadges = computed(() =>
    this.overlaps().flatMap((overlap) => {
      const item = this.ordered().find((item) => item.id === overlap.id);
      const names = describeObjectLayer(this.ordered(), overlap.underneath, (kind) =>
        editorObjectLabel(this.map(), kind),
      );
      return item
        ? [
            {
              id: overlap.id,
              text: names.text,
              bounds: authoredObjectArea(item.prop),
              label: `${editorObjectLabel(this.map(), item.prop.kind)}: ${names.description} · column ${item.prop.x + 1}, row ${item.prop.y + 1}`,
            },
          ]
        : [];
    }),
  );
  protected readonly revealedBounds = signal<ReturnType<typeof authoredObjectArea> | undefined>(
    undefined,
  );
  protected inspectLayers(id: string): void {
    this.cancel();
    this.layerId.set(id);
    this.revealedBounds.set(undefined);
    afterNextRender(() => this.layerDetails()?.nativeElement.focus(), { injector: this.injector });
  }
  protected revealLayer(id: string): void {
    const item = this.layerInfo()?.find((item) => item.id === id);
    if (!item || this.disabled()) return;
    this.cancel();
    this.selected.set(item.selectionId);
    this.revealedBounds.set(item.area);
    this.message.set(`${item.label} selected. Its outline shows its position beneath the artwork.`);
  }
  protected canOrder(direction: 'forward' | 'backward'): boolean {
    const item = this.selection();
    if (!item || item.lock || this.placement()) return false;
    // Pass the explicit current order: defaults would otherwise sort surfaces again.
    const current = this.ordered().map((item) => item.id);
    const step = editorOrderStep(this.map(), item.id, direction);
    return step.some((id, i) => id !== current[i]);
  }
  protected order(direction: 'forward' | 'backward'): void {
    if (!this.active() || !this.canOrder(direction)) return;
    const id = this.selected();
    this.keepSelection = true;
    this.changed.emit({ source: this.map(), command: { kind: 'order', id, direction } });
    this.message.set(
      'Drawing order changed. Movement blocking is unchanged. Undo restores the previous order.',
    );
  }
  protected readonly forestCharacter = computed<ForestCharacter | undefined>(() => {
    const map = this.map();
    return map.type === 'forest' ? map.decoration.character : undefined;
  });
  protected readonly palette = computed(() =>
    editorPalette(this.map()).filter((item) =>
      `${item.label} ${item.category}`.toLowerCase().includes(this.query().trim().toLowerCase()),
    ),
  );
  protected readonly verdict = computed(() => {
    const placement = this.placement();
    return placement ? applyEditorCommand(placement.source, placement.command) : undefined;
  });
  protected readonly ghost = computed(() => {
    const placement = this.placement(),
      verdict = this.verdict();
    if (!placement) return undefined;
    const command = placement.command;
    if (command.kind === 'move-group') {
      const proposal = proposeEditorCommand(placement.source, command);
      if (!proposal.ok) return undefined;
      const group = editorSelections(proposal.document).find((item) => item.groupId === command.id);
      if (!group) return undefined;
      const drawing = resolveEditorMap(proposal.document);
      const items =
        drawing.objectEdits === 'resolved' ? drawing.instances : editorInstances(proposal.document);
      return {
        props: items.filter((item) => group.members.includes(item.id)).map((item) => item.prop),
        bounds: group.area,
        drawing,
        groupId: group.groupId,
        placementAction: this.grab ? ('drop' as const) : ('place' as const),
        valid: !!verdict?.ok,
        reason: verdict && !verdict.ok ? verdict.error : undefined,
      };
    }
    const prop =
      command.kind === 'move'
        ? editorInstances(placement.source).find((p) => p.id === command.id)?.prop
        : {
            kind: command.propKind,
            x: 0,
            y: 0,
            variation: 0.5,
            blocking: isBlockingProp(command.propKind),
          };
    if (!prop) return undefined;
    const moved = { ...prop, x: command.target.x, y: command.target.y };
    return {
      props: [moved],
      bounds: authoredObjectArea(moved),
      valid: !!verdict?.ok,
      reason: verdict && !verdict.ok ? verdict.error : undefined,
    };
  });
  protected readonly rotation = computed(() => {
    const command = this.placement()?.command;
    return command?.kind === 'move-group'
      ? (command.rotation ?? this.selection()?.rotation ?? 0)
      : (this.selection()?.rotation ?? 0);
  });
  protected rotate(direction: -1 | 1): void {
    const item = this.selection();
    if (!this.active() || !item?.groupId || !item.rotatable || item.lock) return;
    this.grab = undefined;
    this.placement.set({
      source: this.map(),
      command: {
        kind: 'move-group',
        id: item.groupId,
        target: this.target() ?? item.position,
        rotation: quarterTurn(this.rotation() + direction),
      },
    });
    this.message.set(
      'Rotation preview. Place object to apply; Escape cancels. Column and Row keep the top-left anchor.',
    );
  }

  protected readonly target = computed(
    () => this.placement()?.command.target ?? this.selection()?.position,
  );
  protected readonly hint = computed(() => {
    const verdict = this.verdict();
    const selection = this.selection();
    if (!verdict && selection)
      return selection.lock
        ? 'Choose an independent object from the list, or use Add object.'
        : 'Drag the selection or set Column and Row. Arrow keys on the map position it; Enter places and Escape cancels.';
    return verdict && !verdict.ok
      ? verdict.error
      : this.placement()
        ? 'Valid position. Drop or choose Place object. Escape cancels.'
        : this.map().type === 'courtyard'
          ? 'Select an object or a complete addition. Use any open ground; standing walls stay fixed.'
          : this.map().type === 'forest'
            ? 'Select an object or a complete addition. Trees stay fixed; solid objects need walkable ground and connected path entrances.'
            : 'Select an object or a complete addition. Walls, doors and architectural markers stay fixed.';
  });
  private readonly preview = viewChild.required(Preview);
  private readonly layerDetails = viewChild<ElementRef<HTMLElement>>('layerDetails');
  private readonly injector = inject(Injector);
  private grab: { x: number; y: number } | undefined;
  private palettePointer:
    { id: number; x: number; y: number; kind: PropKind; dragging: boolean } | undefined;
  private suppressClick = false;
  private keepSelection = false;
  private previousMap?: EditableMapDocument;

  constructor() {
    effect(() => this.editingChanged.emit(this.isEditing()));
    effect(() => {
      const map = this.map();
      this.readOnly();
      untracked(() => {
        if (this.previousMap?.layout !== map.layout) this.layerId.set('');
        if (this.previousMap && this.previousMap.type !== map.type) {
          this.editing.set(false);
          this.paletteOpen.set(false);
          this.query.set('');
        }
        this.previousMap = map;
        this.cancel();
        if (!this.keepSelection || !this.instances().some((item) => item.id === this.selected()))
          this.selected.set('');
        this.keepSelection = false;
        this.revealedBounds.set(undefined);
      });
    });
    effect(() => {
      if (this.disabled()) untracked(() => this.cancel());
    });
  }

  protected setEditing(value: boolean): void {
    if (this.disabled() || this.readOnly()) return;
    this.cancel();
    this.editing.set(value);
    this.paletteOpen.set(false);
    this.message.set('');
  }
  protected select(id: string): void {
    this.cancel();
    this.revealedBounds.set(undefined);
    this.selected.set(id);
    const item = this.selection();
    this.message.set(item ? `${item.label} selected.` : '');
  }
  protected choose(kind: PropKind): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (!this.active()) return;
    this.arm(kind);
    this.paletteOpen.set(false);
    this.message.set('Click or tap a floor square, or set column and row, then place the object.');
  }
  private arm(kind: PropKind): void {
    this.selected.set('');
    this.placement.set({
      source: this.map(),
      command: { kind: 'add', propKind: kind, target: { x: 1, y: 1 } },
    });
  }
  protected pointer(event: EditPointer): void {
    if (!this.active()) return;
    if (event.phase === 'cancel') {
      this.cancel();
      return;
    }
    if (event.phase === 'start') {
      if (this.placement()?.command.kind === 'add') {
        this.setTarget(event.point);
        return;
      }
      const hit = [...this.ordered()].reverse().find(({ prop }) => {
        const b = authoredObjectArea(prop);
        return (
          event.point.x >= b.x &&
          event.point.x < b.x + b.width &&
          event.point.y >= b.y &&
          event.point.y < b.y + b.height
        );
      });
      const unit = hit
        ? this.instances().find((item) => item.members.includes(hit.id))
        : this.instances().find((item) => item.groupId && areaContains(item.area, event.point));
      if (!unit) {
        this.select('');
        return;
      }
      const pending = this.placement()?.command;
      const rotation =
        pending?.kind === 'move-group' && pending.id === unit.groupId
          ? pending.rotation
          : undefined;
      this.select(unit.id);
      if (unit.lock) return;
      this.grab = { x: event.point.x - unit.position.x, y: event.point.y - unit.position.y };
      this.placement.set({
        source: this.map(),
        command: {
          ...this.moveCommand(unit, unit.position),
          ...(unit.groupId && rotation !== undefined ? { rotation } : {}),
        },
      });
    } else if (this.placement()) {
      this.setTarget(event.point);
      if (event.phase === 'end') this.commit();
    }
  }
  private setTarget(point: Point): void {
    const placement = this.placement();
    if (!placement) return;
    const target = this.grab
      ? { x: Math.round(point.x - this.grab.x), y: Math.round(point.y - this.grab.y) }
      : { x: Math.floor(point.x), y: Math.floor(point.y) };
    this.placement.set({ ...placement, command: { ...placement.command, target } });
  }
  private moveCommand(item: EditorSelection | undefined, target: Point): Placement['command'] {
    return item?.groupId
      ? { kind: 'move-group', id: item.groupId, target: { x: target.x, y: target.y } }
      : { kind: 'move', id: item?.id ?? '', target: { x: target.x, y: target.y } };
  }
  protected nudge(delta: Point): void {
    if (!this.active()) return;
    const item = this.selection(),
      placement = this.placement();
    if (!placement && (!item || item.lock)) return;
    const target = this.target();
    if (!target) return;
    const command = placement?.command ?? this.moveCommand(item, target);
    this.placement.set({
      source: placement?.source ?? this.map(),
      command: { ...command, target: { x: target.x + delta.x, y: target.y + delta.y } },
    });
  }
  protected coordinate(axis: 'x' | 'y', event: Event): void {
    if (!(event.target instanceof HTMLInputElement) || !this.active()) return;
    const number = event.target.valueAsNumber,
      target = this.target() ?? { x: 0, y: 0 };
    const item = this.selection(),
      placement = this.placement();
    if (!placement && (!item || item.lock)) return;
    const command = placement?.command ?? this.moveCommand(item, target);
    this.placement.set({
      source: placement?.source ?? this.map(),
      command: { ...command, target: { x: target.x, y: target.y, [axis]: number - 1 } },
    });
  }
  protected commit(): void {
    const placement = this.placement();
    if (!placement || !this.active()) return;
    if (placement.source !== this.map()) {
      this.cancel();
      this.message.set('The map changed. Select the object again.');
      return;
    }
    const verdict = this.verdict();
    if (!verdict?.ok) {
      this.grab = undefined;
      this.message.set(verdict && !verdict.ok ? verdict.error : 'Choose a position.');
      return;
    }
    if (verdict.document === placement.source) {
      this.cancel();
      this.message.set('Selection unchanged. Drag it or choose a new position.');
      return;
    }
    this.changed.emit({ source: placement.source, command: placement.command });
    this.cancel();
    this.message.set(
      'Object placed. Undo restores the previous arrangement. Save to keep it after refresh.',
    );
  }
  protected remove(): void {
    const item = this.selection();
    if (!this.active() || !item || !item.removable || item.lock) return;
    this.changed.emit({ source: this.map(), command: { kind: 'remove', id: item.id } });
    this.cancel();
    this.selected.set('');
    this.message.set('Object removed. Undo restores it.');
  }
  protected reset(): void {
    if (!this.active() || !this.map().objectEdits) return;
    this.changed.emit({ source: this.map(), command: { kind: 'reset' } });
    this.cancel();
    this.message.set('Original generated objects restored. This action can be undone.');
  }
  protected cancel(): void {
    this.placement.set(undefined);
    this.grab = undefined;
    this.palettePointer = undefined;
  }
  protected escape(event: Event): void {
    if (!this.editing()) return;
    event.preventDefault();
    event.stopPropagation();
    this.cancel();
    this.paletteOpen.set(false);
    this.message.set('Placement canceled. Accepted objects are unchanged.');
  }
  protected paletteStart(kind: PropKind, event: PointerEvent): void {
    if (!this.active() || event.button !== 0) return;
    this.suppressClick = false;
    this.palettePointer = {
      id: event.pointerId,
      kind,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
    if (event.currentTarget instanceof HTMLElement)
      event.currentTarget.setPointerCapture(event.pointerId);
  }
  protected paletteMove(event: PointerEvent): void {
    const pointer = this.palettePointer;
    if (!pointer || pointer.id !== event.pointerId || !this.active()) return;
    if (!pointer.dragging && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 5)
      return;
    if (!pointer.dragging) {
      this.arm(pointer.kind);
      pointer.dragging = true;
    }
    const point = this.preview().clientMapPoint(event.clientX, event.clientY);
    if (point) this.setTarget(point);
  }
  protected paletteEnd(event: PointerEvent): void {
    const pointer = this.palettePointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    this.palettePointer = undefined;
    if (!pointer.dragging) return;
    this.suppressClick = true;
    const point = this.preview().clientMapPoint(event.clientX, event.clientY);
    if (point) {
      this.setTarget(point);
      this.commit();
    } else this.cancel();
  }
  protected paletteCancel(event: PointerEvent): void {
    if (this.palettePointer?.id === event.pointerId) {
      this.cancel();
      this.suppressClick = true;
    }
  }
}
