# Design decisions

## Request cancellation

`searchController.ts` gives each search a signal from an `AbortController`.
Every input change aborts the current controller immediately, before the next
debounced request starts. Clearing the field follows the same path. The
controller also ignores state updates for a query that is no longer current,
but this is only a final guard: it does not replace cancellation.

`searchCountries.ts` combines that signal with `AbortSignal.timeout()` using
`AbortSignal.any()`. `AbortError` means the user changed or cleared the query
and is not shown as an error. `TimeoutError`, network failures, and non-404
HTTP responses are reported and can be retried.

`searchCache.ts` gives each caller its own abort signal while sharing the
underlying request. Cancelling one caller does not affect another subscriber.
When every caller has left, the shared request is aborted. Successful responses
are cached by query; failed and aborted requests are not.

## Debounce delay

The input uses a 300 ms delay in `searchController.ts`. This is long enough to
combine the keystrokes in a normal short burst and avoid sending a request for
each character, while still feeling immediate during interactive search.
Without debounce, fast typing creates unnecessary requests. A much longer
delay makes the interface feel unresponsive.

## Complexity

Let `C` be the number of countries returned, and let `L`, `M`, and `B` be the
total number of language, currency, and border entries across them.
`mapCountryResponse()` takes **O(C + L + M + B)** time and space because it
creates a new country object and copies those arrays. This is linear in the
response size.

The bonus cache and in-flight request maps use **O(1) average** lookup by query.
Their memory use is **O(Q + R)**, where `Q` is the number of distinct cached
queries and `R` is the total size of their cached results. Search history is
limited to eight entries in local storage.

## Clean-code choices

- `searchCountries.ts` owns the API call, HTTP status handling, and timeout;
  `mapCountryResponse.ts` is a pure data transformation.
- `classifyError.ts` converts unknown exceptions into a discriminated union, so
  the UI can distinguish cancellation, timeout, HTTP, and network failures.
- `searchController.ts` owns the search state transitions. Its state union makes
  idle, loading, results, empty, and error states explicit.
- `main.ts` renders the interface with DOM methods and `textContent`; it does
  not inject API data through `innerHTML`.
- `searchHistory.ts` and `searchCache.ts` keep persistence and caching outside
  the UI. Tests can provide fake storage and search functions.
- TypeScript strict mode, small named functions, and explicit interfaces make
  invalid states and unexpected dependencies easier to spot.
