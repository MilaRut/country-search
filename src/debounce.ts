export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): DebouncedFunction<Args> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const debounced: DebouncedFunction<Args> = (...args: Args): void => {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = undefined;
      fn(...args);
    }, delay);
  };

  debounced.cancel = (): void => {
    clearTimeout(timerId);
    timerId = undefined;
  };

  return debounced;
}
