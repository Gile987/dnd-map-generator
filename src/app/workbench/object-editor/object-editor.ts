import { doorIsOpen, dungeonDoorAt, dungeonDoors } from '../../engine/dungeon-doors';
import type { DoorToggleRequest } from '../../engine/dungeon-doors';
import type { ExploreClick, ExplorePoint } from '../../preview/preview';
import { isDungeonGroundProp } from '../../rendering/dungeon-prop-layer';
import {
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
import type { DungeonDocument, MapDocument, Point, PropKind } from '../../engine/model';
import { DUNGEON_PALETTE_V2 as DUNGEON_PALETTE } from '../../engine/object-editor/catalog';
import { quarterTurn } from '../../engine/object-editor/group-rotation';
import { applyObjectCommand, proposeObjectCommand } from '../../engine/object-editor/commands';
import type { ObjectCommand } from '../../engine/object-editor/commands';
import { dungeonInstances, resolveDungeon } from '../../engine/object-editor/document';
import { dungeonSelections } from '../../engine/object-editor/dungeon-selection';
import type { DungeonSelection } from '../../engine/object-editor/dungeon-selection';
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
  readonly source: DungeonDocument;
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
  readonly map = input.required<DungeonDocument>();
  readonly grid = input(true);
  readonly focused = input(false);
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly changed = output<ObjectEditRequest>();
  readonly doorToggleRequested = output<DoorToggleRequest>();
  readonly editingChanged = output<boolean>();
  readonly history = input({ undo: 0, redo: 0, limit: 20 });
  readonly historyRequested = output<'undo' | 'redo'>();
  protected readonly doors = computed(() => dungeonDoors(this.map().layout));
  protected readonly openDoorCount = computed(() => this.map().doorStates?.open.length ?? 0);
  protected readonly chosenDoorId = signal('');
  protected readonly chosenDoor = computed(
    () => this.doors().find((door) => door.id === this.chosenDoorId()) ?? this.doors()[0],
  );
  protected readonly chosenDoorOpen = computed(() => {
    const door = this.chosenDoor();
    return !!door && doorIsOpen(this.map(), door.id);
  });
  private readonly hoveredDoor = signal<{ source: MapDocument; id: string } | undefined>(undefined);
  protected readonly doorTarget = computed(() => {
    const hover = this.hoveredDoor(),
      map = this.map();
    if (
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
    const id =
      !this.editing() &&
      !this.disabled() &&
      !this.readOnly() &&
      event.source === this.map() &&
      event.point
        ? dungeonDoorAt(this.map().layout, event.point, event.padding)
        : undefined;
    this.hoveredDoor.set(id ? { source: event.source, id } : undefined);
  }
  protected doorClick(event: ExploreClick): void {
    if (this.editing() || this.disabled() || this.readOnly() || event.source !== this.map()) return;
    const id = dungeonDoorAt(this.map().layout, event.point, event.padding);
    if (id && id === dungeonDoorAt(this.map().layout, event.start, event.padding))
      this.doorToggleRequested.emit({ source: event.source, id });
  }
  protected toggleChosenDoor(): void {
    const door = this.chosenDoor();
    if (door && !this.editing() && !this.disabled() && !this.readOnly())
      this.doorToggleRequested.emit({ source: this.map(), id: door.id });
  }
  protected isDoorOpen(id: string): boolean {
    return doorIsOpen(this.map(), id);
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
  protected readonly instances = computed(() => dungeonSelections(this.map()));
  protected readonly selection = computed(() =>
    this.instances().find((item) => item.id === this.selected()),
  );
  protected readonly palette = computed(() =>
    DUNGEON_PALETTE.filter((item) =>
      `${item.label} ${item.category}`.toLowerCase().includes(this.query().trim().toLowerCase()),
    ),
  );
  protected readonly verdict = computed(() => {
    const placement = this.placement();
    return placement ? applyObjectCommand(placement.source, placement.command) : undefined;
  });
  protected readonly ghost = computed(() => {
    const placement = this.placement(),
      verdict = this.verdict();
    if (!placement) return undefined;
    const command = placement.command;
    if (command.kind === 'move-group') {
      const proposal = proposeObjectCommand(placement.source, command);
      if (!proposal.ok) return undefined;
      const group = dungeonSelections(proposal.document).find(
        (item) => item.groupId === command.id,
      );
      if (!group) return undefined;
      const drawing = resolveDungeon(proposal.document);
      const items =
        drawing.objectEdits === 'resolved'
          ? drawing.instances
          : dungeonInstances(proposal.document);
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
        ? dungeonInstances(placement.source).find((p) => p.id === command.id)?.prop
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
    if (!this.active() || !item?.groupId || item.lock) return;
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
        : 'Select an object or a complete addition. Walls, doors and architectural markers stay fixed.';
  });
  private readonly preview = viewChild.required(Preview);
  private grab: { x: number; y: number } | undefined;
  private palettePointer:
    { id: number; x: number; y: number; kind: PropKind; dragging: boolean } | undefined;
  private suppressClick = false;

  constructor() {
    effect(() => this.editingChanged.emit(this.isEditing()));
    effect(() => {
      this.map();
      this.readOnly();
      untracked(() => {
        this.cancel();
        this.selected.set('');
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
      // Dungeon draws ground first, then objects; reverse for the visible hit target.
      const items = dungeonInstances(this.map()),
        ground = items.filter((p) => isDungeonGroundProp(p.prop)),
        objects = items.filter((p) => !isDungeonGroundProp(p.prop));
      const hit = [...ground, ...objects].reverse().find(({ prop }) => {
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
  private moveCommand(item: DungeonSelection | undefined, target: Point): Placement['command'] {
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
