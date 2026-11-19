import { searchCountries } from './searchCountries.js';
import type { SearchFn } from './searchController.js';
import type { Country } from './types.js';

function abortedError(signal: AbortSignal): unknown {
  return (
    signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
  );
}

function withCallerSignal<T>(
  shared: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(abortedError(signal));
  }

  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      reject(abortedError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });

    shared.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) {
          reject(abortedError(signal));
          return;
        }
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) {
          reject(abortedError(signal));
          return;
        }
        reject(error);
      },
    );
  });
}

export function createSearchCache(
  search: SearchFn = searchCountries,
): SearchFn {
  const cache = new Map<string, Country[]>();
  const inflight = new Map<string, Promise<Country[]>>();

  return (query, signal) => {
    if (signal.aborted) {
      return Promise.reject(abortedError(signal));
    }

    const cached = cache.get(query);
    if (cached !== undefined) {
      return withCallerSignal(Promise.resolve(cached), signal);
    }

    let shared = inflight.get(query);
    if (!shared) {
      shared = search(query, new AbortController().signal).then(
        (countries) => {
          inflight.delete(query);
          cache.set(query, countries);
          return countries;
        },
        (error: unknown) => {
          inflight.delete(query);
          throw error;
        },
      );
      inflight.set(query, shared);
    }

    return withCallerSignal(shared, signal);
  };
}
