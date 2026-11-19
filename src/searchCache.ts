import { searchCountries } from './searchCountries.js';
import type { SearchFn } from './searchController.js';
import type { Country } from './types.js';

function abortedError(signal: AbortSignal): unknown {
  return (
    signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
  );
}

interface InFlightRequest {
  controller: AbortController;
  subscribers: number;
  promise: Promise<Country[]>;
}

function withSignal<T>(shared: Promise<T>, signal: AbortSignal): Promise<T> {
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
  const inflight = new Map<string, InFlightRequest>();

  return (query, signal) => {
    if (signal.aborted) {
      return Promise.reject(abortedError(signal));
    }

    const cached = cache.get(query);
    if (cached !== undefined) {
      return withSignal(Promise.resolve(cached), signal);
    }

    let request = inflight.get(query);
    if (!request) {
      const controller = new AbortController();
      request = {
        controller,
        subscribers: 0,
        promise: Promise.resolve([]),
      };
      inflight.set(query, request);

      let pending: Promise<Country[]>;
      try {
        pending = search(query, controller.signal);
      } catch (error) {
        pending = Promise.reject(error);
      }

      const currentRequest = request;
      request.promise = pending.then(
        (countries) => {
          const activeRequest = inflight.get(query);
          if (activeRequest === currentRequest || activeRequest === undefined) {
            inflight.delete(query);
            cache.set(query, countries);
          }
          return countries;
        },
        (error: unknown) => {
          if (inflight.get(query) === currentRequest) {
            inflight.delete(query);
          }
          throw error;
        },
      );
    }

    const currentRequest = request;
    currentRequest.subscribers += 1;

    return withSignal(currentRequest.promise, signal).finally(() => {
      currentRequest.subscribers -= 1;
      if (
        currentRequest.subscribers === 0 &&
        inflight.get(query) === currentRequest
      ) {
        inflight.delete(query);
        currentRequest.controller.abort();
      }
    });
  };
}
