/**
 * Small deterministic dataset for dropdown/suggestions assertions.
 * Expand carefully — avoid brittle ranking expectations.
 */

export type SuggestionCase = {
  id: string;
  query: string;
  /** Texts expected to appear among visible suggestion buttons. */
  expectedSuggestionTexts: string[];
  /** Optional exact data-search-suggestion attribute match. */
  expectedSuggestionAttr?: string;
  /** Soft check: at least one attribute starts with this prefix. */
  expectedAttrPrefix?: string;
};

export const suggestionCases = {
  productType: {
    id: 'pt-hinge',
    query: 'hinge',
    expectedSuggestionTexts: ['hinge'],
    expectedSuggestionAttr: 'PRODUCT_TYPE:hinge',
    expectedAttrPrefix: 'PRODUCT_TYPE:',
  },
  partialProductType: {
    id: 'pt-hing',
    query: 'hing',
    expectedSuggestionTexts: ['hinge'],
    expectedAttrPrefix: 'PRODUCT_TYPE:',
  },
  brand: {
    id: 'brand-blum',
    query: 'blum',
    expectedSuggestionTexts: ['blum'],
    expectedSuggestionAttr: 'BRAND:blum',
    expectedAttrPrefix: 'BRAND',
  },
  sku: {
    id: 'sku-blu111c',
    query: 'BLU111C',
    expectedSuggestionTexts: ['BLU111C'],
    expectedSuggestionAttr: 'SKU:blu111c',
    expectedAttrPrefix: 'SKU:',
  },
  replaceFrom: {
    id: 'replace-from-screw',
    query: 'screw',
    expectedSuggestionTexts: ['screw'],
    expectedAttrPrefix: 'PRODUCT_TYPE:',
  },
  replaceTo: {
    id: 'replace-to-blum',
    query: 'blum',
    expectedSuggestionTexts: ['blum'],
    expectedSuggestionAttr: 'BRAND:blum',
    expectedAttrPrefix: 'BRAND',
  },
} as const satisfies Record<string, SuggestionCase>;

export const noResultQuery = 'zzzznonexistentproduct12345';

export const shortBelowThresholdQuery = 'h';
