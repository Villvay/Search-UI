/**
 * Config used only by `npx playwright merge-reports` to build the
 * consolidated HTML report after a full Search UI suite.
 */
export default {
  reporter: [
    [
      'html',
      {
        outputFolder: 'reports/html',
        open: 'never',
      },
    ],
  ],
};
