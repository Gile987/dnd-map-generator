export type ObjectShortcut =
  'previous' | 'next' | 'rotate-left' | 'rotate-right' | 'remove' | 'undo' | 'redo';
interface Shortcut {
  readonly key: string;
  readonly action: ObjectShortcut;
  readonly label: string;
  readonly description: string;
  readonly group: 'Selection' | 'Rotation' | 'Undo/Redo';
  readonly command?: boolean;
  readonly shift?: boolean;
}
export const OBJECT_SHORTCUTS: readonly Shortcut[] = [
  {
    key: '[',
    action: 'previous',
    label: '[',
    description: 'Select the previous editable object',
    group: 'Selection',
  },
  {
    key: ']',
    action: 'next',
    label: ']',
    description: 'Select the next editable object',
    group: 'Selection',
  },
  {
    key: 'delete',
    action: 'remove',
    label: 'Delete',
    description: 'Remove the selected object, where allowed',
    group: 'Selection',
  },
  {
    key: 'q',
    action: 'rotate-left',
    label: 'Q',
    description: 'Stage a quarter-turn left',
    group: 'Rotation',
  },
  {
    key: 'e',
    action: 'rotate-right',
    label: 'E',
    description: 'Stage a quarter-turn right',
    group: 'Rotation',
  },
  {
    key: 'z',
    action: 'undo',
    label: 'Ctrl / Cmd + Z',
    description: 'Undo the last accepted map change',
    group: 'Undo/Redo',
    command: true,
  },
  {
    key: 'z',
    action: 'redo',
    label: 'Ctrl / Cmd + Shift + Z',
    description: 'Redo an undone map change',
    group: 'Undo/Redo',
    command: true,
    shift: true,
  },
];
interface ShortcutKey {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly isComposing: boolean;
}
export function objectShortcut(event: ShortcutKey): ObjectShortcut | undefined {
  if (event.isComposing || event.altKey || (event.ctrlKey && event.metaKey)) return undefined;
  const command = event.ctrlKey || event.metaKey;
  return OBJECT_SHORTCUTS.find(
    (shortcut) =>
      shortcut.key === event.key.toLowerCase() &&
      !!shortcut.command === command &&
      (!command || !!shortcut.shift === event.shiftKey),
  )?.action;
}
export const OBJECT_SHORTCUT_GROUPS = ['Selection', 'Movement', 'Rotation', 'Undo/Redo'].map(
  (title) => ({
    title,
    rows:
      title === 'Movement'
        ? [
            { label: 'Arrow keys', description: 'Stage a move by one square' },
            {
              label: 'Enter',
              description: 'Place the object with its staged position and rotation',
            },
            { label: 'Esc', description: 'Cancel the preview' },
          ]
        : OBJECT_SHORTCUTS.filter((shortcut) => shortcut.group === title),
  }),
);
