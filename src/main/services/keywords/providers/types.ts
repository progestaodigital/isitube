import type { KeywordSource } from '@shared/types';

export interface KeywordSourceProvider<T> {
  readonly source: KeywordSource;
  readonly name: string;

  /**
   * Fetch raw data for the given term. Throw on failure — the enricher
   * catches via Promise.allSettled and converts to a `SourceResult` with
   * `status: 'error'` so the rest of the pipeline keeps going.
   */
  fetch(term: string): Promise<T>;
}
