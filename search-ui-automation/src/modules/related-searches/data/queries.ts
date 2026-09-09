/**
 * Dataset for Related Searches (suggestions-dropdown surface).
 */

export type RelatedSearchesQueryCase = {
  id: string;
  value: string;
  expectedItemTexts?: string[];
  expectedAttr?: string;
  notes?: string;
};

export const relatedSearchesQueries = {
  withRelated: {
    id: 'with-related-hinge',
    value: 'hinge',
    expectedItemTexts: ['hinge'],
    expectedAttr: 'PRODUCT_TYPE:hinge',
    notes: 'Opens suggestions dropdown with Related Search items.',
  },
  withRelatedAlt: {
    id: 'with-related-screw',
    value: 'screw',
    expectedItemTexts: ['screw'],
  },
  brandRelated: {
    id: 'brand-blum',
    value: 'blum',
    expectedItemTexts: ['blum'],
    expectedAttr: 'BRAND:blum',
  },
  noRelated: {
    id: 'no-related',
    value: 'zzzznonexistentproduct12345',
    notes: 'Empty Related Searches / No Suggestions to Display.',
  },
} as const satisfies Record<string, RelatedSearchesQueryCase>;

/** Deterministic labels keyed by query (expand carefully). */
export const expectedRelatedSearchesByQuery: Record<string, string[]> = {
  hinge: ['hinge'],
  screw: ['screw'],
  blum: ['blum'],
};
