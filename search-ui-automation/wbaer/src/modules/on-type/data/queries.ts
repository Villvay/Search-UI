/**
 * Representative on-type query dataset.
 * Expand by adding entries — keep tests data-driven where practical.
 */

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
  /** Expected to cross the on-type activation threshold. */
  expectActiveOnType: boolean;
  notes?: string;
};

export const onTypeQueries = {
  shortBelowThreshold: {
    id: 'short-1',
    category: 'short',
    value: 'h',
    expectActiveOnType: false,
    notes: 'Below minCharacters (2); idle/trending remains.',
  },
  minimumValid: {
    id: 'min-1',
    category: 'minimum-valid',
    value: 'hi',
    expectActiveOnType: true,
    notes: 'First length that triggers /suggestions.',
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
    value: 'screw',
    expectActiveOnType: true,
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
    value: 'BLU111C',
    expectActiveOnType: true,
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
    notes: 'Length >= minCharacters; activates on-type columns.',
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
    value: 'zzzznonexistentproduct12345',
    expectActiveOnType: true,
    notes: 'Shows empty suggestion/results messaging in dropdown.',
  },
} as const satisfies Record<string, OnTypeQuery>;

/** Incremental typing path for ON-TYPE-002. */
export const incrementalTypingPath = ['h', 'hi', 'hin', 'hing', 'hinge'] as const;
