export type OnTypeQueryCategory =
  | 'minimum-valid'
  | 'normal'
  | 'partial'
  | 'short'
  | 'long'
  | 'numeric'
  | 'alphanumeric'
  | 'special-character'
  | 'whitespace'
  | 'no-result';

export type OnTypeQuery = {
  id: string;
  category: OnTypeQueryCategory;
  value: string;
  expectActiveOnType: boolean;
  notes?: string;
};

export const onTypeQueries = {
  shortBelowThreshold: {
    id: 'short-1',
    category: 'short',
    value: 'h',
    expectActiveOnType: false,
    notes: 'Below minCharacters (2); idle dropdown remains.',
  },
  minimumValid: {
    id: 'min-1',
    category: 'minimum-valid',
    value: 'hi',
    expectActiveOnType: true,
  },
  partial: {
    id: 'partial-1',
    category: 'partial',
    value: 'hin',
    expectActiveOnType: true,
  },
  normal: {
    id: 'normal-1',
    category: 'normal',
    value: 'hinge',
    expectActiveOnType: true,
    notes: 'Verified on wurthlac.com SERP and dropdown products/categories.',
  },
  replacement: {
    id: 'normal-2',
    category: 'normal',
    value: 'blum',
    expectActiveOnType: true,
  },
  priorForReplace: {
    id: 'normal-3',
    category: 'normal',
    value: 'accuride',
    expectActiveOnType: true,
    notes: 'Observed in live recent-search history on wurthlac.com.',
  },
  rapidPrior: {
    id: 'normal-4',
    category: 'normal',
    value: 'drawer',
    expectActiveOnType: true,
  },
  numeric: {
    id: 'numeric-1',
    category: 'numeric',
    value: '12345',
    expectActiveOnType: true,
  },
  alphanumeric: {
    id: 'alpha-1',
    category: 'alphanumeric',
    value: 'B79T853',
    expectActiveOnType: true,
    notes: 'WLAC catalog SKU from lac-sku-cache, not a Baer SKU.',
  },
  specialCharacter: {
    id: 'special-1',
    category: 'special-character',
    value: 'hinge@#$',
    expectActiveOnType: true,
  },
  whitespace: {
    id: 'ws-1',
    category: 'whitespace',
    value: '   ',
    expectActiveOnType: true,
  },
  long: {
    id: 'long-1',
    category: 'long',
    value: 'a'.repeat(80),
    expectActiveOnType: true,
  },
  noResult: {
    id: 'noresult-1',
    category: 'no-result',
    value: 'qwertyuiopasdfghjklzxcvbnm-nomatch-probe',
    expectActiveOnType: true,
    notes: 'Verified zero-hit SERP on wurthlac.com.',
  },
} as const satisfies Record<string, OnTypeQuery>;

export const incrementalTypingPath = ['h', 'hi', 'hin', 'hing', 'hinge'] as const;
