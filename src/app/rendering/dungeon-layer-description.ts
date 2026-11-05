import { dungeonCapability } from '../engine/object-editor/catalog';
import type { PropKind } from '../engine/model';
import type { AddedObject } from '../engine/object-editor/document';

/** Names are derived from the accepted objects, never persisted as a second model.
 * Read the stack from top to bottom, matching its inspection list.
 */
export function describeObjectLayer(
  items: readonly AddedObject[],
  underneath: readonly string[],
  label: (kind: PropKind) => string,
): { readonly text: string; readonly description: string } {
  const objects = new Map(items.map((item) => [item.id, item.prop]));
  const counts = new Map<string, number>();
  for (const id of [...underneath].reverse()) {
    const prop = objects.get(id);
    if (!prop) continue;
    const name = label(prop.kind);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const names = [...counts].map(([name, count]) => (count > 1 ? `${name} × ${count}` : name));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const first = counts.entries().next().value;
  if (!first) return { text: 'No objects underneath', description: 'No objects underneath' };
  const compact =
    names.length === 1 || (names.length === 2 && names.join(' + ').length <= 28)
      ? names.join(' + ')
      : `${names[0]} + ${total - first[1]} more`;
  return { text: `${compact} underneath`, description: `${names.join(', ')} underneath` };
}

export function describeDungeonLayer(items: readonly AddedObject[], underneath: readonly string[]) {
  return describeObjectLayer(
    items,
    underneath,
    (kind) => dungeonCapability(kind, 2)?.label ?? kind,
  );
}
