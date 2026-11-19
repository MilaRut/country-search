import { afterEach, describe, expect, it, vi } from 'vitest';
import spainJson from './fixtures/spain.json' with { type: 'json' };
import { HttpError } from './errors.js';
import { searchCountries } from './searchCountries.js';

function newSignal(): AbortSignal {
  return new AbortController().signal;
}

function stubFetchWith(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubHangingFetch() {
  const fetchMock = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          return;
        }
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpError', () => {
  it('is an Error that carries the response status', () => {
    const error = new HttpError(503);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(503);
  });
});

describe('searchCountries', () => {
  it('requests the name endpoint with the query', async () => {
    const fetchMock = stubFetchWith(
      new Response(JSON.stringify(spainJson), { status: 200 }),
    );

    await searchCountries('spain', newSignal());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://countries.dev/name/spain',
    );
  });

  it('encodes special characters of the query', async () => {
    const fetchMock = stubFetchWith(
      new Response(JSON.stringify(spainJson), { status: 200 }),
    );

    await searchCountries('a b/c', newSignal());

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://countries.dev/name/a%20b%2Fc',
    );
  });

  it('passes an abort signal to fetch', async () => {
    const fetchMock = stubFetchWith(
      new Response(JSON.stringify(spainJson), { status: 200 }),
    );

    await searchCountries('spain', newSignal());

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('resolves with mapped countries on a successful response', async () => {
    stubFetchWith(new Response(JSON.stringify(spainJson), { status: 200 }));

    const result = await searchCountries('spain', newSignal());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      code: 'ESP',
      name: 'Spain',
      capital: 'Madrid',
    });
  });

  it('resolves with an empty array on 404 (no matches)', async () => {
    stubFetchWith(new Response(null, { status: 404 }));

    await expect(searchCountries('zzzzz', newSignal())).resolves.toEqual([]);
  });

  it.each([400, 403, 429, 500, 503])(
    'rejects with HttpError carrying status %i',
    async (status) => {
      stubFetchWith(new Response(null, { status }));

      const error = await rejection(searchCountries('spain', newSignal()));

      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(status);
    },
  );

  it('propagates a network failure as is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const error = await rejection(searchCountries('spain', newSignal()));

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(HttpError);
  });

  it('rejects with AbortError when the caller aborts the request', async () => {
    stubHangingFetch();
    const controller = new AbortController();

    const promise = searchCountries('spain', controller.signal);
    controller.abort();
    const error = await rejection(promise);

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('AbortError');
  });

  it('rejects with AbortError if the signal is already aborted', async () => {
    stubHangingFetch();
    const controller = new AbortController();
    controller.abort();

    const error = await rejection(searchCountries('spain', controller.signal));

    expect((error as DOMException).name).toBe('AbortError');
  });

  it('rejects with TimeoutError when there is no response in time', async () => {
    stubHangingFetch();

    const error = await rejection(searchCountries('spain', newSignal(), 20));

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('TimeoutError');
  });
});
