import { test, expect } from '../../../core/fixtures';
import { expectScannerButtonVisible } from '../assertions/barcodeScannerAssertions';
import { BARCODE_SCANNER_BEHAVIOR } from '../data/behavior';
import { BarcodeScannerPage } from '../pages/BarcodeScannerPage';

test.describe('Barcode scanner UI @barcode', () => {
  test('BARCODE-001 @smoke - The barcode scanner control is present in the header', async ({
    page,
  }) => {
    const barcodePage = new BarcodeScannerPage(page);
    await barcodePage.openHome();
    await expectScannerButtonVisible(barcodePage);
  });

  test('BARCODE-002 - Opening the scanner does not navigate away from the storefront', async ({
    page,
  }) => {
    const barcodePage = new BarcodeScannerPage(page);
    await barcodePage.openHome();
    const before = page.url();
    await barcodePage.scannerButton().first().click();
    await expect(page).toHaveURL(before, {
      timeout: BARCODE_SCANNER_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect(barcodePage.searchPage.searchBox.input()).toBeVisible();
  });

  test('BARCODE-003 - Barcode API lookup is not assumed from the Baer suite', async () => {
    expect(BARCODE_SCANNER_BEHAVIOR.apiVerified).toBeFalsy();
  });
});
