import { HttpError } from './errors.js';

export type SearchFailure =
  | { kind: 'aborted' }
  | { kind: 'timeout' }
  | { kind: 'http'; status: number }
  | { kind: 'network' }
  | { kind: 'unknown' };

function hasName(value: unknown, name: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    value.name === name
  );
}

export function classifyError(error: unknown): SearchFailure {
  if (hasName(error, 'AbortError')) {
    return { kind: 'aborted' };
  }
  if (hasName(error, 'TimeoutError')) {
    return { kind: 'timeout' };
  }
  if (error instanceof HttpError) {
    return { kind: 'http', status: error.status };
  }
  if (error instanceof TypeError) {
    return { kind: 'network' };
  }
  return { kind: 'unknown' };
}

export function shouldReport(failure: SearchFailure): boolean {
  return failure.kind !== 'aborted';
}
