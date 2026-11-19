export const HISTORY_STORAGE_KEY = 'country-search-history';
export const HISTORY_LIMIT = 8;

export interface HistoryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface SearchHistory {
  read: () => string[];
  remember: (query: string) => string[];
}

function parseHistory(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== 'string')
    ) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export function createSearchHistory(
  storage: HistoryStorage = localStorage,
): SearchHistory {
  function read(): string[] {
    return parseHistory(storage.getItem(HISTORY_STORAGE_KEY));
  }

  function remember(query: string): string[] {
    const trimmed = query.trim();
    if (trimmed === '') {
      return read();
    }

    const next = [trimmed, ...read().filter((item) => item !== trimmed)].slice(
      0,
      HISTORY_LIMIT,
    );
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  return { read, remember };
}
