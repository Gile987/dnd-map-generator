import { expect, test } from 'vitest';
import { objectShortcut } from './shortcuts';

const key = (value: string, modifiers: Partial<Parameters<typeof objectShortcut>[0]> = {}) => ({
  key: value,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  isComposing: false,
  ...modifiers,
});
test.each([
  ['[', 'previous'],
  [']', 'next'],
  ['q', 'rotate-left'],
  ['Q', 'rotate-left'],
  ['e', 'rotate-right'],
  ['E', 'rotate-right'],
  ['Delete', 'remove'],
] as const)('%s invokes %s without browser modifiers', (value, action) => {
  expect(objectShortcut(key(value))).toBe(action);
  expect(objectShortcut(key(value, { ctrlKey: true }))).toBeUndefined();
  expect(objectShortcut(key(value, { metaKey: true }))).toBeUndefined();
  expect(objectShortcut(key(value, { altKey: true }))).toBeUndefined();
  expect(objectShortcut(key(value, { isComposing: true }))).toBeUndefined();
});
test.each(['ctrlKey', 'metaKey'] as const)('%s supports accepted map undo and redo', (modifier) => {
  expect(objectShortcut(key('z', { [modifier]: true }))).toBe('undo');
  expect(objectShortcut(key('Z', { [modifier]: true, shiftKey: true }))).toBe('redo');
  expect(objectShortcut(key('z', { [modifier]: true, altKey: true }))).toBeUndefined();
  expect(objectShortcut(key('z', { [modifier]: true, isComposing: true }))).toBeUndefined();
});
test('unbound keys and mixed system modifiers are left alone', () => {
  for (const value of ['z', 'Backspace', 'Tab', 'ArrowLeft', 'Enter', 'Escape', 'a', '?'])
    expect(objectShortcut(key(value))).toBeUndefined();
  expect(objectShortcut(key('z', { ctrlKey: true, metaKey: true }))).toBeUndefined();
});
