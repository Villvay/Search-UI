import fs from 'fs';
import path from 'path';

export type BarcodeSkuDataset = {
  source: string;
  profile: 'smoke' | 'regression';
  limit: number;
  skus: string[];
};

function readDataset(relativeUnderData: string): BarcodeSkuDataset {
  const full = path.resolve(
    process.cwd(),
    'src/modules/barcode-navigation/data',
    relativeUnderData,
  );
  const raw = JSON.parse(fs.readFileSync(full, 'utf8')) as BarcodeSkuDataset;
  if (!Array.isArray(raw.skus) || raw.skus.length === 0) {
    throw new Error(`Barcode dataset empty or invalid: ${full}`);
  }
  return raw;
}

/** Full regression set (50 SKUs). Smoke tags use the first 10. */
export function loadRegressionSkus(): BarcodeSkuDataset {
  return readDataset('regression-skus.json');
}

export function loadSmokeSkus(): BarcodeSkuDataset {
  return readDataset('smoke-skus.json');
}
