import { expect } from '@playwright/test';
import { BARCODE_SCANNER_BEHAVIOR } from '../data/behavior';
import { type BarcodeScannerPage } from '../pages/BarcodeScannerPage';

export async function expectScannerButtonVisible(
  barcodePage: BarcodeScannerPage,
): Promise<void> {
  await expect(barcodePage.scannerButton().first()).toBeVisible({
    timeout: BARCODE_SCANNER_BEHAVIOR.uiSettleTimeoutMs,
  });
}
