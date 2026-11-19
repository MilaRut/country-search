import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call fn immediately', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();

    expect(fn).not.toHaveBeenCalled();
  });

  it('calls fn once after the delay has passed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call fn before the delay has passed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(299);

    expect(fn).not.toHaveBeenCalled();
  });

  it('resets the timer when called again within the delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(200);
    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls fn only once for a burst of calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes the arguments of the last call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('s');
    debounced('sp');
    debounced('spain');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledWith('spain');
  });

  it('can fire again after a previous invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    vi.advanceTimersByTime(300);
    debounced('b');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('keeps independent timers for independent debounced functions', () => {
    const first = vi.fn();
    const second = vi.fn();
    const debouncedFirst = debounce(first, 300);
    const debouncedSecond = debounce(second, 300);

    debouncedFirst();
    vi.advanceTimersByTime(300);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    debouncedSecond();
  });
});
