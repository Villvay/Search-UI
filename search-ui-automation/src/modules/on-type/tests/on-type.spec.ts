import { test, expect } from '../../../core/fixtures';
import {
  expectActiveOnTypeState,
  expectIdleOnTypeState,
  expectInputHasValue,
  expectNoResultOnTypeMessaging,
  expectSuggestionsReflectQuery,
} from '../assertions/onTypeAssertions';
import { ON_TYPE_BEHAVIOR } from '../data/behavior';
import {
  incrementalTypingPath,
  onTypeQueries,
} from '../data/queries';
import { OnTypeSearchPage } from '../pages/OnTypeSearchPage';

/**
 * ON-TYPE module — validates typing-driven search UI state only.
 * Suggestion ranking/selection belongs to a future SUGGESTIONS module.
 */
test.describe('On-type search', () => {
  test.describe.configure({ mode: 'parallel' });

  test('ON-TYPE-001 - Search responds to minimum query length', async ({
    page,
  }) => {
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
    await expectSuggestionsReflectQuery(
      onType,
      onTypeQueries.minimumValid.value,
    );
  });

  test('ON-TYPE-002 - Search updates while query is being typed', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    let composed = '';
    for (const chunk of incrementalTypingPath) {
      // Type only the newly added character(s) to simulate incremental input.
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
        await expectSuggestionsReflectQuery(onType, composed);
      }
    }
  });

  test('ON-TYPE-003 - Clearing query resets on-type state', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    await onType.typeAndAwaitOnTypeState(onTypeQueries.normal.value);
    await expectActiveOnTypeState(onType);

    await onType.clearQuery();
    await expectInputHasValue(onType.input(), '');
    await expectIdleOnTypeState(onType);
  });

  test('ON-TYPE-004 - Replacing query updates on-type state', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    await onType.typeAndAwaitOnTypeState(onTypeQueries.priorForReplace.value);
    await expectActiveOnTypeState(onType);
    await expectSuggestionsReflectQuery(
      onType,
      onTypeQueries.priorForReplace.value,
    );

    await onType.clearQuery();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.replacement.value);
    await expectInputHasValue(onType.input(), onTypeQueries.replacement.value);
    await expectActiveOnTypeState(onType);
    await expectSuggestionsReflectQuery(
      onType,
      onTypeQueries.replacement.value,
    );

    // Prior query should not remain as the only visible suggestion signal.
    const text = (await onType.suggestionsColumn().innerText()).toLowerCase();
    expect(
      text.includes(onTypeQueries.replacement.value.toLowerCase()) ||
        text.includes('no suggestions to display'),
    ).toBeTruthy();
  });

  test('ON-TYPE-005 - Rapid typing settles on final query state', async ({
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
    await expectSuggestionsReflectQuery(onType, onTypeQueries.normal.value);

    const suggestionText = (
      await onType.suggestionsColumn().innerText()
    ).toLowerCase();
    // Stale prior-query-only UI should not remain after the final query settles.
    if (!suggestionText.includes('no suggestions to display')) {
      expect(suggestionText).toContain(onTypeQueries.normal.value.toLowerCase());
    }
  });

  test('ON-TYPE-006 - Numeric query activates on-type UI', async ({
    page,
  }) => {
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
    await expectSuggestionsReflectQuery(
      onType,
      onTypeQueries.alphanumeric.value,
    );
  });

  test('ON-TYPE-008 - Special-character query activates on-type UI', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.specialCharacter.value);
    await expectInputHasValue(
      onType.input(),
      onTypeQueries.specialCharacter.value,
    );
    await expectActiveOnTypeState(onType);
  });

  test('ON-TYPE-009 - Whitespace query activates on-type UI', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();

    await onType.typeQuery(onTypeQueries.whitespace.value);
    await expectInputHasValue(onType.input(), onTypeQueries.whitespace.value);
    await expectActiveOnTypeState(onType);
  });

  test('ON-TYPE-010 - Long query activates on-type UI', async ({ page }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.long.value);
    await expectInputHasValue(onType.input(), onTypeQueries.long.value);
    await expectActiveOnTypeState(onType);
  });

  test('ON-TYPE-011 - No-matching query shows empty on-type messaging', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await onType.typeAndAwaitOnTypeState(onTypeQueries.noResult.value);
    await expectInputHasValue(onType.input(), onTypeQueries.noResult.value);
    await expectNoResultOnTypeMessaging(onType);
  });

  test('ON-TYPE-012 - Search input accepts typed characters', async ({
    page,
  }) => {
    const onType = new OnTypeSearchPage(page);
    await onType.open();
    await onType.focusSearch();
    await expect(onType.input()).toBeEditable();
    await onType.typeQuerySequentially(onTypeQueries.normal.value);
    await expectInputHasValue(onType.input(), onTypeQueries.normal.value);
  });
});
