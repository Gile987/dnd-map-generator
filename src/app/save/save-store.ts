import { Injectable, signal } from '@angular/core';
import type { GeneratedMap } from '../engine/model';
import {
  SAVE_STORAGE_KEY,
  duplicateName,
  makeSavedMap,
  normalizeName,
  parseSavedMap,
  serializeBundle,
  uniqueById,
} from './save-format';
import type { SavedMap } from './save-format';

@Injectable({ providedIn: 'root' })
export class SaveStore {
  private readonly records = signal<SavedMap[]>(this.load());
  readonly saved = this.records.asReadonly();

  add(map: GeneratedMap, name: string, thumbnail: string): SavedMap {
    const record = makeSavedMap(
      map,
      name,
      thumbnail,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    this.commit([record, ...this.records()]);
    return record;
  }

  remove(id: string): void {
    this.commit(this.records().filter((record) => record.id !== id));
  }

  rename(id: string, name: string): void {
    this.commit(
      this.records().map((record) =>
        record.id === id ? { ...record, name: normalizeName(name) || record.name } : record,
      ),
    );
  }

  duplicate(id: string): void {
    const source = this.records().find((record) => record.id === id);
    if (!source) return;
    const copy: SavedMap = {
      ...source,
      id: crypto.randomUUID(),
      name: duplicateName(source.name),
      favorite: false,
      savedAt: new Date().toISOString(),
    };
    this.commit([copy, ...this.records()]);
  }

  toggleFavorite(id: string): void {
    this.commit(
      this.records().map((record) =>
        record.id === id ? { ...record, favorite: !record.favorite } : record,
      ),
    );
  }

  importMaps(maps: readonly SavedMap[]): { added: number; skipped: number } {
    const existing = new Set(this.records().map((record) => record.id));
    const { fresh, skipped } = uniqueById(maps, existing);
    if (fresh.length > 0) this.commit([...fresh, ...this.records()]);
    return { added: fresh.length, skipped };
  }

  exportBundle(): string {
    return serializeBundle(this.records());
  }

  private load(): SavedMap[] {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_STORAGE_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];
    try {
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.map(parseSavedMap).filter((record): record is SavedMap => record !== undefined);
    } catch {
      return [];
    }
  }

  private commit(next: SavedMap[]): void {
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error('Your browser could not write to local storage. It may be full or blocked.');
    }
    this.records.set(next);
  }
}
