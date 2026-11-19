import { describe, expect, it } from 'vitest';
import { classifyError, shouldReport } from './classifyError.js';
import { HttpError } from './errors.js';

describe('classifyError', () => {
  it('classifies a DOMException AbortError as aborted', () => {
    const error = new DOMException('The operation was aborted', 'AbortError');

    expect(classifyError(error)).toEqual({ kind: 'aborted' });
  });

  it('classifies the reason of a manually aborted signal as aborted', () => {
    const controller = new AbortController();
    controller.abort();

    expect(classifyError(controller.signal.reason)).toEqual({
      kind: 'aborted',
    });
  });

  it('classifies a DOMException TimeoutError as timeout', () => {
    const error = new DOMException('The operation timed out', 'TimeoutError');

    expect(classifyError(error)).toEqual({ kind: 'timeout' });
  });

  it('classifies the reason of a timed out signal as timeout', () => {
    const signal = AbortSignal.abort(
      new DOMException('The operation timed out', 'TimeoutError'),
    );

    expect(classifyError(signal.reason)).toEqual({ kind: 'timeout' });
  });

  it('tells AbortError and TimeoutError apart', () => {
    const aborted = classifyError(new DOMException('x', 'AbortError'));
    const timedOut = classifyError(new DOMException('x', 'TimeoutError'));

    expect(aborted).not.toEqual(timedOut);
  });

  it('classifies a plain Error named AbortError as aborted', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';

    expect(classifyError(error)).toEqual({ kind: 'aborted' });
  });

  it.each([400, 429, 500, 503])(
    'classifies HttpError %i as http and keeps the status',
    (status) => {
      expect(classifyError(new HttpError(status))).toEqual({
        kind: 'http',
        status,
      });
    },
  );

  it('classifies a TypeError from fetch as network', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toEqual({
      kind: 'network',
    });
  });

  it('classifies other errors as unknown', () => {
    expect(classifyError(new SyntaxError('Unexpected token'))).toEqual({
      kind: 'unknown',
    });
    expect(classifyError(new Error('boom'))).toEqual({ kind: 'unknown' });
  });

  it.each([['text'], [42], [null], [undefined], [{}]])(
    'classifies the non-error value %j as unknown',
    (value) => {
      expect(classifyError(value)).toEqual({ kind: 'unknown' });
    },
  );
});

describe('shouldReport', () => {
  it('does not report own cancellation to the user', () => {
    expect(shouldReport({ kind: 'aborted' })).toBe(false);
  });

  it.each([
    [{ kind: 'timeout' }],
    [{ kind: 'http', status: 500 }],
    [{ kind: 'network' }],
    [{ kind: 'unknown' }],
  ] as const)('reports %j to the user', (failure) => {
    expect(shouldReport(failure)).toBe(true);
  });
});
