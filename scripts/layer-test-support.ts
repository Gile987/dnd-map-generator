import { editorFixture } from './editor-test-support';
import { applyObjectCommand } from '../src/app/engine/object-editor/commands';
import type { ObjectCommand } from '../src/app/engine/object-editor/commands';
import { dungeonInstances } from '../src/app/engine/object-editor/document';
import { individualObjectLock } from '../src/app/engine/object-editor/dungeon-authoring-rules';
import type { DungeonDocument } from '../src/app/engine/model';

export function acceptLayerCommand(
  document: DungeonDocument,
  command: ObjectCommand,
): DungeonDocument {
  const result = applyObjectCommand(document, command);
  if (!result.ok) throw Error(result.error);
  return result.document;
}
export function layeredRugFixture() {
  const base = editorFixture();
  const rug = dungeonInstances(base).find((item) => item.prop.kind === 'rug');
  if (!rug) throw Error('Missing rug');
  let prepared: DungeonDocument = base;
  for (const item of dungeonInstances(base))
    if (item.id !== rug.id && !individualObjectLock(base, item.id, item.prop))
      prepared = acceptLayerCommand(prepared, { kind: 'remove', id: item.id });
  prepared = acceptLayerCommand(prepared, { kind: 'add', propKind: 'barrel', target: rug.prop });
  prepared = acceptLayerCommand(prepared, {
    kind: 'add',
    propKind: 'crate',
    target: { x: rug.prop.x + 1, y: rug.prop.y },
  });
  const once = acceptLayerCommand(prepared, { kind: 'order', id: rug.id, direction: 'forward' });
  const covered = acceptLayerCommand(once, { kind: 'order', id: rug.id, direction: 'forward' });
  return { base, rug, prepared, once, covered };
}
