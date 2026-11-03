import { doorIsOpen, dungeonDoorId } from '../engine/dungeon-doors';
import type { DoorStates } from '../engine/dungeon-doors';
import type { Layout, Threshold } from '../engine/model';
import type { DrawingContext } from './drawing-context';

/** Closed doors deliberately retain the original renderer commands and pixels. */
export function drawDungeonDoors(
  ctx: DrawingContext,
  map: { readonly layout: Layout; readonly doorStates?: DoorStates },
): void {
  for (const door of map.layout.thresholds) {
    ctx.save();
    ctx.translate(door.x, door.y);
    if (door.axis === 'vertical') ctx.rotate(Math.PI / 2);
    if (doorIsOpen(map, dungeonDoorId(door))) drawOpenDoor(ctx, map.layout, door);
    else {
      ctx.fillStyle = '#35494c';
      ctx.fillRect(0.1, -0.15, 1.8, 0.3);
      ctx.fillStyle = '#a4936f';
      ctx.fillRect(0.18, -0.085, 1.64, 0.17);
      ctx.strokeStyle = '#c6b994';
      ctx.lineWidth = 0.02;
      for (const x of [0.24, 0.75, 1.25, 1.76]) {
        ctx.beginPath();
        ctx.moveTo(x, -0.07);
        ctx.lineTo(x, 0.07);
        ctx.stroke();
      }
    }
    for (const x of [0, 1.83]) {
      ctx.fillStyle = '#2e4249';
      ctx.fillRect(x, -0.29, 0.17, 0.58);
      ctx.fillStyle = '#8d9f97';
      ctx.fillRect(x, -0.29, 0.17, 0.06);
    }
    ctx.restore();
  }
}

function drawOpenDoor(ctx: DrawingContext, layout: Layout, door: Threshold): void {
  const room = layout.rooms.find((r) => r.id === door.roomId);
  const centre = room
    ? { x: room.x + room.width / 2, y: room.y + room.height / 2 }
    : { x: door.x - 1, y: door.y + 1 };
  const side = (door.axis === 'horizontal' ? centre.y - door.y : door.x - centre.x) >= 0 ? 1 : -1;
  // Two leaves swing toward the room, leaving the full central opening visible.
  for (const x of [0.18, 1.82]) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate((side * Math.PI) / 2);
    ctx.fillStyle = '#14282d85';
    ctx.fillRect(0.03, -0.065, 0.8, 0.18);
    ctx.fillStyle = '#806c49';
    ctx.fillRect(0, -0.085, 0.78, 0.17);
    ctx.fillStyle = '#b19d6c';
    ctx.fillRect(0, -0.085, 0.78, 0.035);
    ctx.strokeStyle = '#c6b994';
    ctx.lineWidth = 0.016;
    for (const grain of [0.16, 0.39, 0.64]) {
      ctx.beginPath();
      ctx.moveTo(grain, -0.06);
      ctx.lineTo(grain, 0.06);
      ctx.stroke();
    }
    ctx.fillStyle = '#d4bd80';
    ctx.beginPath();
    ctx.arc(0.62, 0, 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
