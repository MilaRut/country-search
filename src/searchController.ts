import {
  classifyError,
  shouldReport,
  type SearchFailure,
} from './classifyError.js';
import { debounce } from './debounce.js';
import { searchCountries } from './searchCountries.js';
import type { Country } from './types.js';

export const SEARCH_DEBOUNCE_MS = 300;

export type SearchViewState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'results'; query: string; countries: Country[] }
  | { status: 'empty'; query: string }
  | { status: 'error'; query: string; failure: SearchFailure };

export type SearchFn = (
  query: string,
  signal: AbortSignal,
) => Promise<Country[]>;

export interface SearchControllerOptions {
  delay?: number;
  search?: SearchFn;
  onStateChange?: (state: SearchViewState) => void;
}

export interface SearchController {
  setQuery: (raw: string) => void;
  searchNow: (raw: string) => void;
  retry: () => void;
  selectCountry: (code: string) => void;
  getState: () => SearchViewState;
  getSelected: () => Country | null;
}

export function createSearchController(
  options: SearchControllerOptions = {},
): SearchController {
  const delay = options.delay ?? SEARCH_DEBOUNCE_MS;
  const search = options.search ?? searchCountries;
  let state: SearchViewState = { status: 'idle' };
  let selected: Country | null = null;
  let lastQuery = '';
  let controller = new AbortController();

  function notify(): void {
    options.onStateChange?.(state);
  }

  function setState(next: SearchViewState): void {
    state = next;
    notify();
  }

  function abortCurrent(): void {
    controller.abort();
    controller = new AbortController();
  }

  async function runSearch(query: string): Promise<void> {
    const signal = controller.signal;
    setState({ status: 'loading', query });

    try {
      const countries = await search(query, signal);
      if (lastQuery !== query) {
        return;
      }
      if (countries.length === 0) {
        setState({ status: 'empty', query });
        return;
      }
      setState({ status: 'results', query, countries });
    } catch (error) {
      if (lastQuery !== query) {
        return;
      }
      const failure = classifyError(error);
      if (!shouldReport(failure)) {
        return;
      }
      setState({ status: 'error', query, failure });
    }
  }

  const scheduleSearch = debounce(() => {
    if (lastQuery === '') {
      return;
    }
    void runSearch(lastQuery);
  }, delay);

  function setQuery(raw: string): void {
    const query = raw.trim();
    lastQuery = query;
    selected = null;
    abortCurrent();

    if (query === '') {
      scheduleSearch.cancel();
      setState({ status: 'idle' });
      return;
    }

    setState({ status: 'loading', query });
    scheduleSearch();
  }

  function searchNow(raw: string): void {
    const query = raw.trim();
    lastQuery = query;
    selected = null;
    abortCurrent();
    scheduleSearch.cancel();

    if (query === '') {
      setState({ status: 'idle' });
      return;
    }

    void runSearch(query);
  }

  function retry(): void {
    if (lastQuery === '') {
      return;
    }
    scheduleSearch.cancel();
    abortCurrent();
    void runSearch(lastQuery);
  }

  function selectCountry(code: string): void {
    if (state.status !== 'results') {
      selected = null;
      notify();
      return;
    }
    selected = state.countries.find((country) => country.code === code) ?? null;
    notify();
  }

  return {
    setQuery,
    searchNow,
    retry,
    selectCountry,
    getState: () => state,
    getSelected: () => selected,
  };
}
