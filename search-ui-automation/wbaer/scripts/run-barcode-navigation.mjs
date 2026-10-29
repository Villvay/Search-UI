/**
 * Run barcode / QR navigation validation (Python suite from QA-Search-main).
 *
 * Standalone — not part of smoke or regression cycles.
 *
 *   npm run test:barcode
 *   npm run test:qr-code
 *
 * Env (forwarded to Python):
 *   ENVIRONMENT=qa|prod
 *   BARCODE_API_URL / BASE_URL / SEARCH_API_URL
 *   BARCODES_JSON_PATH / BARCODES_CSV_PATH / SKU_SET
 *   MAX_WORKERS / ROUND / REQUEST_TIMEOUT_S / …
 *   BARCODE_API_MOCK=1  — offline unit-style fixtures
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = path.join(root, 'barcode-navigation-validation');
const runPy = path.join(moduleDir, 'run.py');

if (!fs.existsSync(runPy)) {
  console.error(
    `Missing ${path.relative(root, runPy)} — barcode-navigation-validation was not copied into this repo.`,
  );
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const python = process.env.PYTHON || process.env.PYTHON3 || 'python3';

const child = spawn(python, [runPy, ...extraArgs], {
  cwd: moduleDir,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Barcode navigation exited via signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
