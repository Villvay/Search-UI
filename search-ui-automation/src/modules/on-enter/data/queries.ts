/**
 * Small maintainable dataset for ON-ENTER scenarios.
 */

export type OnEnterQueryCase = {
  id: string;
  value: string;
  /** Expected final landing after Enter. */
  expectedLanding: 'search' | 'search-no-results' | 'none' | 'product-or-search';
  notes?: string;
};

export const onEnterQueries = {
  validProduct: {
    id: 'valid-hinge',
    value: 'hinge',
    expectedLanding: 'search',
  },
  validProductType: {
    id: 'valid-screw',
    value: 'screw',
    expectedLanding: 'search',
  },
  replaceFrom: {
    id: 'replace-from',
    value: 'screw',
    expectedLanding: 'search',
  },
  replaceTo: {
    id: 'replace-to',
    value: 'blum',
    expectedLanding: 'search',
  },
  numeric: {
    id: 'numeric',
    value: '12345',
    expectedLanding: 'search',
  },
  /**
   * Non-SKU alphanumeric stays on SERP.
   * Exact SKUs (e.g. BLU111C) may intent-route to PDP — not used here.
   */
  alphanumeric: {
    id: 'alphanumeric',
    value: 'abc123',
    expectedLanding: 'search',
    notes: 'Non-SKU alphanumeric. Exact SKUs may redirect to PDP.',
  },
  specialCharacter: {
    id: 'special',
    value: 'hinge@#$',
    expectedLanding: 'search',
  },
  noResult: {
    id: 'no-result',
    value: 'zzzznonexistentproduct12345',
    expectedLanding: 'search-no-results',
  },
  empty: {
    id: 'empty',
    value: '',
    expectedLanding: 'none',
  },
  whitespace: {
    id: 'whitespace',
    value: '   ',
    expectedLanding: 'search-no-results',
    notes: 'Navigates to /search?q=+++ with No Results UI.',
  },
  long: {
    id: 'long',
    value: 'a'.repeat(80),
    expectedLanding: 'search',
  },
  dropdownOpenQuery: {
    id: 'dropdown-open',
    value: 'drawer',
    expectedLanding: 'search',
    notes: 'Enter with suggestions open still runs normal search.',
  },
} as const satisfies Record<string, OnEnterQueryCase>;
