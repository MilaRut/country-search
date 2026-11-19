import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  createSearchHistory,
} from './searchHistory.js';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    store,
    getItem(key: string): string | null {
      return Object.hasOwn(store, key) ? store[key]! : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
  };
}

describe('createSearchHistory', () => {
  it('starts empty when storage has no history', () => {
    const history = createSearchHistory(createMemoryStorage());

    expect(history.read()).toEqual([]);
  });

  it('remembers a query as the most recent item', () => {
    const storage = createMemoryStorage();
    const history = createSearchHistory(storage);

    expect(history.remember('spain')).toEqual(['spain']);
    expect(JSON.parse(storage.store[HISTORY_STORAGE_KEY] ?? '[]')).toEqual([
      'spain',
    ]);
  });

  it('moves a repeated query to the front instead of duplicating it', () => {
    const history = createSearchHistory(createMemoryStorage());

    history.remember('spain');
    history.remember('united');
    expect(history.remember('spain')).toEqual(['spain', 'united']);
  });

  it('ignores empty and whitespace-only queries', () => {
    const history = createSearchHistory(createMemoryStorage());

    history.remember('spain');
    expect(history.remember('')).toEqual(['spain']);
    expect(history.remember('   ')).toEqual(['spain']);
  });

  it(`keeps at most ${HISTORY_LIMIT} items`, () => {
    const history = createSearchHistory(createMemoryStorage());

    for (let index = 1; index <= HISTORY_LIMIT + 2; index += 1) {
      history.remember(`q${index}`);
    }

    const items = history.read();
    expect(items).toHaveLength(HISTORY_LIMIT);
    expect(items[0]).toBe(`q${HISTORY_LIMIT + 2}`);
    expect(items.at(-1)).toBe('q3');
  });

  it('reads previously stored history', () => {
    const storage = createMemoryStorage({
      [HISTORY_STORAGE_KEY]: JSON.stringify(['spain', 'france']),
    });
    const history = createSearchHistory(storage);

    expect(history.read()).toEqual(['spain', 'france']);
  });

  it('treats invalid stored JSON as empty history', () => {
    const storage = createMemoryStorage({
      [HISTORY_STORAGE_KEY]: '{not-json',
    });
    const history = createSearchHistory(storage);

    expect(history.read()).toEqual([]);
  });
});
