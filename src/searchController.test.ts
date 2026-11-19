import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import spainJson from './fixtures/spain.json' with { type: 'json' };
import unitedJson from './fixtures/united.json' with { type: 'json' };
import { HttpError } from './errors.js';
import { mapCountryResponse } from './mapCountryResponse.js';
import { createSearchController } from './searchController.js';
import type { Country } from './types.js';

const spain = mapCountryResponse(spainJson);
const united = mapCountryResponse(unitedJson);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createSearchMock() {
  const calls: {
    query: string;
    signal: AbortSignal;
    resolve: (value: Country[]) => void;
    reject: (reason?: unknown) => void;
  }[] = [];

  const search = vi.fn((query: string, signal: AbortSignal) => {
    const pending = deferred<Country[]>();
    const call = {
      query,
      signal,
      resolve: pending.resolve,
      reject: pending.reject,
    };
    calls.push(call);

    if (signal.aborted) {
      pending.reject(signal.reason);
    } else {
      signal.addEventListener(
        'abort',
        () => {
          pending.reject(signal.reason);
        },
        { once: true },
      );
    }

    return pending.promise;
  });

  return { search, calls };
}

describe('createSearchController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in the idle state and does not search', () => {
    const { search } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    expect(controller.getState()).toEqual({ status: 'idle' });
    expect(search).not.toHaveBeenCalled();
  });

  it('does not send a request for an empty query', async () => {
    const { search } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).not.toHaveBeenCalled();
    expect(controller.getState()).toEqual({ status: 'idle' });
  });

  it('does not send a request for a whitespace-only query', async () => {
    const { search } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('   ');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).not.toHaveBeenCalled();
    expect(controller.getState()).toEqual({ status: 'idle' });
  });

  it('does not search before the debounce delay elapses', async () => {
    const { search } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(299);

    expect(search).not.toHaveBeenCalled();
  });

  it('searches once with the last query after the debounce delay', async () => {
    const { search } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('s');
    controller.setQuery('sp');
    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('spain', expect.any(AbortSignal));
  });

  it('shows loading as soon as the user types a non-empty query', () => {
    const { search } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('sp');

    expect(controller.getState()).toEqual({ status: 'loading', query: 'sp' });
  });

  it('aborts the in-flight request on the next keystroke, before debounce elapses', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    expect(search).toHaveBeenCalledTimes(1);
    const firstSignal = calls[0]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    controller.setQuery('spa');

    expect(firstSignal?.aborted).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toEqual({ status: 'loading', query: 'spa' });
  });

  it('does not report own cancellation as an error', async () => {
    const { search, calls } = createSearchMock();
    const onStateChange = vi.fn();
    const controller = createSearchController({
      search,
      delay: 300,
      onStateChange,
    });

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    controller.setQuery('spain');
    await Promise.resolve();

    expect(calls[0]?.signal.aborted).toBe(true);
    expect(controller.getState()).toEqual({
      status: 'loading',
      query: 'spain',
    });
    expect(
      onStateChange.mock.calls.some(
        ([state]) => (state as { status: string }).status === 'error',
      ),
    ).toBe(false);
  });

  it('clears results and goes idle when the query is emptied, aborting the request', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    controller.setQuery('');
    await Promise.resolve();

    expect(calls[0]?.signal.aborted).toBe(true);
    expect(controller.getState()).toEqual({ status: 'idle' });
  });

  it('moves to results when the search resolves with countries', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.resolve(spain);
    await Promise.resolve();

    expect(controller.getState()).toEqual({
      status: 'results',
      query: 'spain',
      countries: spain,
    });
  });

  it('treats an empty match list as empty, not as an error', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('zzzzz');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.resolve([]);
    await Promise.resolve();

    expect(controller.getState()).toEqual({
      status: 'empty',
      query: 'zzzzz',
    });
  });

  it('reports a timeout as an error the user can retry', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.reject(
      new DOMException('The operation timed out', 'TimeoutError'),
    );
    await Promise.resolve();

    expect(controller.getState()).toEqual({
      status: 'error',
      query: 'spain',
      failure: { kind: 'timeout' },
    });
  });

  it('reports an HttpError as an error and keeps the status', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.reject(new HttpError(503));
    await Promise.resolve();

    expect(controller.getState()).toEqual({
      status: 'error',
      query: 'spain',
      failure: { kind: 'http', status: 503 },
    });
  });

  it('reports a network TypeError as an error', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.reject(new TypeError('Failed to fetch'));
    await Promise.resolve();

    expect(controller.getState()).toEqual({
      status: 'error',
      query: 'spain',
      failure: { kind: 'network' },
    });
  });

  it('does nothing on retry when there is no last query', async () => {
    const { search } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.retry();
    await vi.advanceTimersByTimeAsync(300);

    expect(search).not.toHaveBeenCalled();
  });

  it('retries the last query immediately, without waiting for debounce', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.reject(new TypeError('Failed to fetch'));
    await Promise.resolve();

    controller.retry();

    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenLastCalledWith('spain', expect.any(AbortSignal));
    expect(controller.getState()).toEqual({
      status: 'loading',
      query: 'spain',
    });
  });

  it('retries the last entered query even after the user has seen results', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('united');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.resolve(united);
    await Promise.resolve();

    controller.retry();
    calls[1]?.resolve(united);
    await Promise.resolve();

    expect(search.mock.calls[1]?.[0]).toBe('united');
    expect(controller.getState()).toMatchObject({
      status: 'results',
      query: 'united',
    });
  });

  it('selects a country from the current results by code', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.resolve(spain);
    await Promise.resolve();

    controller.selectCountry('ESP');

    expect(controller.getSelected()).toEqual(spain[0]);
  });

  it('clears the selection when the query changes', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.resolve(spain);
    await Promise.resolve();
    controller.selectCountry('ESP');

    controller.setQuery('spa');

    expect(controller.getSelected()).toBeNull();
  });

  it('does not select a country that is not in the current results', async () => {
    const { search, calls } = createSearchMock();
    const controller = createSearchController({ search, delay: 300 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.resolve(spain);
    await Promise.resolve();

    controller.selectCountry('USA');

    expect(controller.getSelected()).toBeNull();
  });
});

function queryFromUrl(input: RequestInfo | URL): string {
  const url = String(input);
  return decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
}

function createAbortAwareFetch() {
  const resolvers = new Map<
    string,
    { resolve: (response: Response) => void; signal: AbortSignal }
  >();

  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const signal = init?.signal;
        const fail = (): void => {
          reject(
            signal?.reason ??
              new DOMException('The operation was aborted', 'AbortError'),
          );
        };

        if (!signal) {
          return;
        }
        if (signal.aborted) {
          fail();
          return;
        }

        signal.addEventListener('abort', fail, { once: true });
        resolvers.set(queryFromUrl(input), { resolve, signal });
      }),
  );

  function resolveQuery(query: string, body: unknown, status = 200): boolean {
    const pending = resolvers.get(query);
    if (!pending || pending.signal.aborted) {
      return false;
    }
    pending.resolve(new Response(JSON.stringify(body), { status }));
    return true;
  }

  return { fetchMock, resolveQuery };
}

describe('request race', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps only the latest query when an older response would arrive later', async () => {
    const { fetchMock, resolveQuery } = createAbortAwareFetch();
    vi.stubGlobal('fetch', fetchMock);
    const controller = createSearchController({ delay: 300 });

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    const staleRequest = fetchMock.mock.results[0]?.value as Promise<Response>;
    const staleSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    controller.setQuery('spain');
    await Promise.resolve();

    expect(staleSignal.aborted).toBe(true);
    await expect(staleRequest).rejects.toMatchObject({ name: 'AbortError' });

    await vi.advanceTimersByTimeAsync(300);
    expect(resolveQuery('spain', spainJson)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(resolveQuery('sp', unitedJson)).toBe(false);
    await vi.advanceTimersByTimeAsync(0);

    expect(controller.getState()).toEqual({
      status: 'results',
      query: 'spain',
      countries: spain,
    });
  });
});
