import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { downloadBlob } from './download';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubDownloadBrowser() {
  const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
  const append = vi.fn();
  const createElement = vi.fn(() => link);
  vi.stubGlobal('document', { createElement, body: { append } });
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download-test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return { link, append, createElement, createUrl, revoke };
}

describe('Blob downloads', () => {
  test('sets the download filename, activates an attached link, and releases resources after 30 seconds', () => {
    const { link, append, createElement, createUrl, revoke } = stubDownloadBrowser();
    const blob = new Blob(['backup'], { type: 'application/json' });
    link.click.mockImplementation(() => {
      expect(append).toHaveBeenCalledExactlyOnceWith(link);
      expect(link.href).toBe('blob:download-test');
      expect(link.download).toBe('maps.json');
      expect(link.remove).not.toHaveBeenCalled();
    });
    downloadBlob(blob, 'maps.json');
    expect(createUrl).toHaveBeenCalledExactlyOnceWith(blob);
    expect(createElement).toHaveBeenCalledExactlyOnceWith('a');
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(29999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:download-test');
  });

  test('an object-URL failure propagates without creating a link or scheduling cleanup for a nonexistent URL', () => {
    const { createUrl, createElement, revoke } = stubDownloadBrowser();
    createUrl.mockImplementation(() => {
      throw new Error('URL unavailable');
    });
    expect(() => downloadBlob(new Blob(['map']), 'map.png')).toThrow('URL unavailable');
    expect(createElement).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(['create', 'append', 'click', 'remove'] as const)(
    'releases the allocated URL when %s throws, including cleanup failures',
    (stage) => {
      const { link, createElement, append, revoke } = stubDownloadBrowser();
      const failure = new Error(`${stage} failed`);
      const operation = { create: createElement, append, click: link.click, remove: link.remove }[
        stage
      ];
      operation.mockImplementation(() => {
        throw failure;
      });
      expect(() => downloadBlob(new Blob(['map']), 'map.png')).toThrow(failure);
      if (stage === 'create') expect(link.remove).not.toHaveBeenCalled();
      else expect(link.remove).toHaveBeenCalledOnce();
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(30000);
      expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:download-test');
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test('each download uses its own anchor, filename, and object-URL lifetime', () => {
    const { link: firstLink, createElement, append, createUrl, revoke } = stubDownloadBrowser();
    const secondLink = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    createElement.mockReturnValueOnce(firstLink).mockReturnValueOnce(secondLink);
    createUrl.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    for (const [index, link, url, filename] of [
      [1, firstLink, 'blob:first', 'first.json'],
      [2, secondLink, 'blob:second', 'second.png'],
    ] as const) {
      link.click.mockImplementation(() => {
        expect(append).toHaveBeenNthCalledWith(index, link);
        expect(link.href).toBe(url);
        expect(link.download).toBe(filename);
        expect(link.remove).not.toHaveBeenCalled();
      });
    }
    downloadBlob(new Blob(['first']), 'first.json');
    expect(firstLink.click).toHaveBeenCalledOnce();
    expect(firstLink.remove).toHaveBeenCalledOnce();
    expect(secondLink.click).not.toHaveBeenCalled();
    expect(secondLink.remove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    downloadBlob(new Blob(['second']), 'second.png');
    expect(createElement.mock.calls).toEqual([['a'], ['a']]);
    expect(append).toHaveBeenCalledTimes(2);
    expect(firstLink.href).toBe('blob:first');
    expect(firstLink.download).toBe('first.json');
    expect(firstLink.click).toHaveBeenCalledOnce();
    expect(firstLink.remove).toHaveBeenCalledOnce();
    expect(secondLink.click).toHaveBeenCalledOnce();
    expect(secondLink.remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(29000);
    expect(revoke.mock.calls).toEqual([['blob:first']]);
    vi.advanceTimersByTime(1000);
    expect(revoke.mock.calls).toEqual([['blob:first'], ['blob:second']]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
