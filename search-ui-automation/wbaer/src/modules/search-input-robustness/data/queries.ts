/**
 * Deterministic search-input robustness fixtures.
 * Values are data only — never executed as code.
 */

export type InputCategory =
  | 'normal'
  | 'whitespace'
  | 'special'
  | 'unicode'
  | 'emoji'
  | 'html-like'
  | 'javascript-like'
  | 'template-like'
  | 'encoded'
  | 'long'
  | 'empty'
  | 'whitespace-only';

export type RobustnessQuery = {
  category: InputCategory;
  value: string;
  /** Safe label for reports when value must not be echoed fully. */
  reportLabel?: string;
};

export function longInput(length: number): string {
  const prefix = 'hinge-';
  if (length <= prefix.length) return 'h'.repeat(length);
  return prefix + 'x'.repeat(length - prefix.length);
}

export const searchInputRobustnessQueries = {
  normal: {
    hinge: { category: 'normal' as const, value: 'hinge' },
    screw: { category: 'normal' as const, value: 'screw' },
    doorHinge: { category: 'normal' as const, value: 'door hinge' },
  },
  whitespace: {
    singleSpace: { category: 'whitespace' as const, value: ' ' },
    tripleSpace: { category: 'whitespace' as const, value: '   ' },
    paddedHinge: { category: 'whitespace' as const, value: ' hinge ' },
    multiInternal: {
      category: 'whitespace' as const,
      value: 'hinge   screw',
    },
  },
  special: [
    'hinge & screw',
    'hinge/screw',
    'hinge-screw',
    'hinge_screw',
    'hinge.screw',
    'hinge:screw',
    'hinge+screw',
    'hinge=screw',
    'hinge?screw',
    'hinge#screw',
  ].map((value) => ({ category: 'special' as const, value })),
  unicode: [
    'café',
    'naïve',
    'Müller',
    '東京',
    '中文',
  ].map((value) => ({ category: 'unicode' as const, value })),
  emoji: [
    { category: 'emoji' as const, value: '🔧' },
    { category: 'emoji' as const, value: '🔩' },
    { category: 'emoji' as const, value: 'hinge 🔧' },
  ],
  htmlLike: [
    { category: 'html-like' as const, value: '<b>hinge</b>' },
    { category: 'html-like' as const, value: '<img src=x>' },
    { category: 'html-like' as const, value: '<div>hinge</div>' },
  ],
  javascriptLike: [
    {
      category: 'javascript-like' as const,
      value: '<script>alert(1)</script>',
      reportLabel: 'javascript-like:script-alert',
    },
    {
      category: 'javascript-like' as const,
      value: 'javascript:alert(1)',
      reportLabel: 'javascript-like:javascript-uri',
    },
    {
      category: 'javascript-like' as const,
      value: '"><script>alert(1)</script>',
      reportLabel: 'javascript-like:breakout-script',
    },
  ],
  templateLike: [
    { category: 'template-like' as const, value: '${7*7}' },
    { category: 'template-like' as const, value: '{{7*7}}' },
    { category: 'template-like' as const, value: '<%= 7*7 %>' },
  ],
  encoded: [
    { category: 'encoded' as const, value: 'hinge%20screw' },
    { category: 'encoded' as const, value: '%3Cscript%3E' },
    { category: 'encoded' as const, value: '%22%3E' },
  ],
  longLengths: [100, 500, 1000, 2000] as const,
  empty: { category: 'empty' as const, value: '' },
  whitespaceOnly: {
    category: 'whitespace-only' as const,
    value: '     ',
  },
  syncSamples: [
    { category: 'special' as const, value: 'hinge & screw' },
    { category: 'unicode' as const, value: 'café' },
    { category: 'unicode' as const, value: '東京' },
    { category: 'html-like' as const, value: '<b>hinge</b>' },
  ],
  stateIsolation: {
    queryA: { category: 'normal' as const, value: 'hinge' },
    queryB: {
      category: 'html-like' as const,
      value: '<b>screw</b>',
    },
  },
  repeatedUnusual: {
    category: 'html-like' as const,
    value: '<img src=x>',
  },
  runtimeSample: [
    { category: 'normal' as const, value: 'hinge' },
    { category: 'special' as const, value: 'hinge & screw' },
    { category: 'html-like' as const, value: '<b>hinge</b>' },
    {
      category: 'javascript-like' as const,
      value: '<script>alert(1)</script>',
      reportLabel: 'javascript-like:script-alert',
    },
    { category: 'unicode' as const, value: '東京' },
  ],
};

export function longQuery(length: number): RobustnessQuery {
  return {
    category: 'long',
    value: longInput(length),
    reportLabel: `length=${length}`,
  };
}
