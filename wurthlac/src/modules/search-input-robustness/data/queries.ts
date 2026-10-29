export const inputQueries = {
  normal: 'hinge',
  leadingTrailing: ' hinge ',
  internal: 'hinge   screw',
  special: 'hinge@#$',
  unicode: 'café',
  emoji: 'hinge 🔧',
  html: '<b>hinge</b>',
  script: '<script>alert(1)</script>',
  encoded: 'hinge%20screw',
  long: `hinge-${'x'.repeat(200)}`,
  empty: '',
  whitespace: '   ',
} as const;
