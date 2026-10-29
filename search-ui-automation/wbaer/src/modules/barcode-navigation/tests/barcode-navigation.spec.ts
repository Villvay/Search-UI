import { test } from '../../../core/fixtures';
import { expectBarcodeNavigatesToPlp } from '../assertions/barcodeAssertions';
import { loadRegressionSkus } from '../data/skuLoader';
import { lookupBarcode } from '../utils/barcodeApi';

/**
 * BARCODE / QR navigation — API validation that a barcode/SKU lookup
 * returns exactly one product with direct PLP navigation.
 *
 * Smoke: BARCODE-001…010 (@smoke) — 10 SKUs
 * Regression: BARCODE-001…050 — 50 SKUs
 *
 * Independent of Playwright UI modules; uses APIRequestContext only.
 */
const dataset = loadRegressionSkus();

test.describe('Barcode / QR navigation @barcode', () => {
  test.describe.configure({ mode: 'parallel' });

  for (let i = 0; i < dataset.skus.length; i += 1) {
    const sku = dataset.skus[i];
    const id = `BARCODE-${String(i + 1).padStart(3, '0')}`;
    const smokeTag = i < 10 ? ' @smoke' : '';

    test(`${id}${smokeTag} - Barcode "${sku}" navigates to single PLP product`, async ({
      request,
    }, testInfo) => {
      test.setTimeout(45_000);
      const result = await lookupBarcode(request, sku);
      expectBarcodeNavigatesToPlp(result, testInfo);
    });
  }
});
