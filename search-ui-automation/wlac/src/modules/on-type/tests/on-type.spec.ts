import { test, expect } from '../../../core/fixtures';
import {
  expectActiveOnTypeState,
  expectIdleOnTypeState,
  expectInputHasValue,
  expectResultsReflectQuery,
} from '../assertions/onTypeAssertions';
import { ON_TYPE_BEHAVIOR } from '../data/behavior';
import { incrementalTypingPath, onTypeQueries } from '../data/queries';
import { OnTypeSearchPage } from '../pages/OnTypeSearchPage';

function annotate(
  testInfo: { annotations: { type: string; description?: string }[] },
  fields: Record<string, string>,
): void {
  for (const [type, description] of Object.entries(fields)) {
    testInfo.annotations.push({ type, description });
  }
}

test.describe('On-type search @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('ON-TYPE-001 @smoke - Search responds to minimum query length', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Minimum length activates on-type',
      query: `${onTypeQueries.shortBelowThreshold.value} → ${onTypeQueries.minimumValid.value}`,
    });

    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await expectIdleOnTypeState(onType);

    await onType.typeQuerySequentially(onTypeQueries.shortBelowThreshold.value);
    await expectInputHasValue(
      onType.input(),
      onTypeQueries.shortBelowThreshold.value,
    );
    await expectIdleOnTypeState(onType);

    await onType.clearQuery();
    await onType.typeQuerySequentially(onTypeQueries.minimumValid.value);
    await expectInputHasValue(onType.input(), onTypeQueries.minimumValid.value);
    await expectActiveOnTypeState(onType);
    await expectResultsReflectQuery(onType, onTypeQueries.minimumValid.value);
  });

  test('ON-TYPE-002 - Search updates while query is being typed', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Incremental typing updates on-type',
      query: incrementalTypingPath.join(' → '),
    });

    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    let composed = '';
    for (const chunk of incrementalTypingPath) {
      const addition = chunk.slice(composed.length);
      composed = chunk;
      if (addition) {
        await onType.typeQuerySequentially(addition);
      }

      await expectInputHasValue(onType.input(), composed);

      if (composed.length < ON_TYPE_BEHAVIOR.minCharacters) {
        await expectIdleOnTypeState(onType);
      } else {
        await expectActiveOnTypeState(onType);
        await expectResultsReflectQuery(onType, composed);
      }
    }
  });

  test('ON-TYPE-003 @smoke - Clearing query resets on-type state', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Clear query resets on-type',
      query: onTypeQueries.normal.value,
    });

    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    await onType.typeAndAwaitOnTypeState(onTypeQueries.normal.value);
    await expectActiveOnTypeState(onType);

    await onType.clearQuery();
    await expectInputHasValue(onType.input(), '');
    await expectIdleOnTypeState(onType);
  });

  test('ON-TYPE-004 - Typing updates suggestions appropriately', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    await onType.typeAndAwaitOnTypeState(onTypeQueries.priorForReplace.value);
    await expectActiveOnTypeState(onType);
    await expectResultsReflectQuery(
      onType,
      onTypeQueries.priorForReplace.value,
    );

    await onType.clearQuery();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.replacement.value);
    await expectInputHasValue(onType.input(), onTypeQueries.replacement.value);
    await expectActiveOnTypeState(onType);
    await expectResultsReflectQuery(onType, onTypeQueries.replacement.value);
  });

  test('ON-TYPE-005 - Rapid typing settles on the latest query', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    await onType.typeQuerySequentially(onTypeQueries.rapidPrior.value, 8);
    await onType.clearQuery();
    await onType.typeQuerySequentially(onTypeQueries.normal.value, 8);

    await expectInputHasValue(onType.input(), onTypeQueries.normal.value);
    await expectActiveOnTypeState(onType);
    await expectResultsReflectQuery(onType, onTypeQueries.normal.value);
  });

  test('ON-TYPE-006 - Numeric query activates on-type UI', async ({ page }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.numeric.value);
    await expectInputHasValue(onType.input(), onTypeQueries.numeric.value);
    await expectActiveOnTypeState(onType);
  });

  test('ON-TYPE-007 - Alphanumeric query activates on-type UI', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.alphanumeric.value);
    await expectInputHasValue(onType.input(), onTypeQueries.alphanumeric.value);
    await expectActiveOnTypeState(onType);
  });

  test('ON-TYPE-008 - Special-character query is handled', async ({ page }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.specialCharacter.value);
    await expectInputHasValue(
      onType.input(),
      onTypeQueries.specialCharacter.value,
    );
    await expect(onType.input()).toBeVisible();
  });

  test('ON-TYPE-009 - Whitespace is handled', async ({ page }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeQuerySequentially(onTypeQueries.whitespace.value);
    await expectInputHasValue(onType.input(), onTypeQueries.whitespace.value);
    await expect(onType.input()).toBeVisible();
  });

  test('ON-TYPE-010 - Long input does not break the UI', async ({ page }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.long.value);
    await expectInputHasValue(onType.input(), onTypeQueries.long.value);
    await expect(onType.input()).toBeVisible();
  });

  test('ON-TYPE-011 - A no-match query displays the active dropdown', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.noResult.value);
    await expectInputHasValue(onType.input(), onTypeQueries.noResult.value);
    await expectActiveOnTypeState(onType);
  });

  test('ON-TYPE-012 - Replacing a query does not leave stale suggestions', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    await onType.typeAndAwaitOnTypeState(onTypeQueries.priorForReplace.value);
    await onType.clearQuery();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.replacement.value);

    const text = (await onType.resultsColumn().innerText()).toLowerCase();
    expect(text).toContain(onTypeQueries.replacement.value.toLowerCase());
  });
});
