import { describe, expect, it, vi } from 'vitest';
import spainJson from './fixtures/spain.json' with { type: 'json' };
import unitedJson from './fixtures/united.json' with { type: 'json' };
import { mapCountryResponse } from './mapCountryResponse.js';
import { createSearchCache } from './searchCache.js';
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
  const pending = deferred<Country[]>();
  const search = vi.fn(() => pending.promise);
  return { search, pending };
}

describe('createSearchCache', () => {
  it('returns a cached result without calling search again', async () => {
    const search = vi.fn().mockResolvedValue(spain);
    const cached = createSearchCache(search);

    await cached('spain', new AbortController().signal);
    const second = await cached('spain', new AbortController().signal);

    expect(search).toHaveBeenCalledTimes(1);
    expect(second).toEqual(spain);
  });

  it('does not reuse a cached result for a different query', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(spain)
      .mockResolvedValueOnce(united);
    const cached = createSearchCache(search);

    await cached('spain', new AbortController().signal);
    const result = await cached('united', new AbortController().signal);

    expect(search).toHaveBeenCalledTimes(2);
    expect(result).toEqual(united);
  });

  it('shares one in-flight request for the same query', async () => {
    const { search, pending } = createSearchMock();
    const cached = createSearchCache(search);

    const first = cached('spain', new AbortController().signal);
    const second = cached('spain', new AbortController().signal);

    expect(search).toHaveBeenCalledTimes(1);
    pending.resolve(spain);

    await expect(first).resolves.toEqual(spain);
    await expect(second).resolves.toEqual(spain);
  });

  it('does not abort the shared request when one caller cancels', async () => {
    const { search, pending } = createSearchMock();
    const cached = createSearchCache(search);
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = cached('spain', firstController.signal);
    const second = cached('spain', secondController.signal);

    firstController.abort();
    pending.resolve(spain);

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toEqual(spain);
    expect(search.mock.calls[0]?.[1].aborted).toBe(false);
  });

  it('rejects a caller whose signal is already aborted without starting a search', async () => {
    const search = vi.fn().mockResolvedValue(spain);
    const cached = createSearchCache(search);
    const controller = new AbortController();
    controller.abort();

    await expect(cached('spain', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('serves a completed in-flight result from cache after one caller aborted', async () => {
    const { search, pending } = createSearchMock();
    const cached = createSearchCache(search);
    const firstController = new AbortController();

    const first = cached('spain', firstController.signal);
    firstController.abort();
    pending.resolve(spain);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });

    const second = await cached('spain', new AbortController().signal);

    expect(search).toHaveBeenCalledTimes(1);
    expect(second).toEqual(spain);
  });

  it('does not cache a failed search', async () => {
    const error = new TypeError('Failed to fetch');
    const search = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(spain);
    const cached = createSearchCache(search);

    await expect(cached('spain', new AbortController().signal)).rejects.toBe(
      error,
    );

    await expect(
      cached('spain', new AbortController().signal),
    ).resolves.toEqual(spain);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('caches an empty result list', async () => {
    const search = vi.fn().mockResolvedValue([]);
    const cached = createSearchCache(search);

    await cached('zzzzz', new AbortController().signal);
    await cached('zzzzz', new AbortController().signal);

    expect(search).toHaveBeenCalledTimes(1);
  });
});
