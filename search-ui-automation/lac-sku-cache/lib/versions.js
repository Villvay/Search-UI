const fs = require('fs');
const path = require('path');

const VERSIONS_PATH = path.resolve(__dirname, '..', 'versions.json');

function readVersions() {
  if (!fs.existsSync(VERSIONS_PATH)) {
    throw new Error(`Version config not found: ${VERSIONS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(VERSIONS_PATH, 'utf8'));
}

function writeVersions(versions) {
  fs.writeFileSync(VERSIONS_PATH, `${JSON.stringify(versions, null, 2)}\n`);
}

function datasetVersion(siteKey, versions = readVersions()) {
  const dataset = versions.datasets?.[siteKey];
  if (!dataset) {
    throw new Error(`No dataset version configured for SITE="${siteKey}" in versions.json`);
  }
  const current = (dataset.versions || []).find((row) => row.version === dataset.latest);
  if (!current) {
    throw new Error(
      `Dataset ${siteKey} latest version "${dataset.latest}" is not listed in versions.json`,
    );
  }
  return {
    site: siteKey,
    version: current.version,
    createdAt: current.createdAt,
    file: current.file,
    skuCount: current.skuCount,
    notes: current.notes || '',
    moduleVersion: versions.module?.version || '',
    moduleCreatedAt: versions.module?.createdAt || '',
  };
}

/**
 * Append a finished run. Dataset version rows stay as edited in versions.json.
 */
function recordRun(entry) {
  const versions = readVersions();
  const createdAt = entry.createdAt || new Date().toISOString();
  const version =
    entry.version || `${entry.site}-${createdAt.slice(0, 19).replace(/:/g, '-')}Z`;
  const moduleRoot = path.resolve(__dirname, '..');
  const reportDir = path.isAbsolute(entry.reportDir)
    ? path.relative(moduleRoot, entry.reportDir)
    : entry.reportDir;
  const row = {
    version,
    site: entry.site,
    createdAt,
    moduleVersion: versions.module?.version || '',
    datasetVersion: entry.datasetVersion,
    datasetCreatedAt: entry.datasetCreatedAt,
    skuCount: entry.skuCount,
    passed: entry.passed,
    failed: entry.failed,
    reportDir,
  };
  versions.runs = [row, ...(versions.runs || []).filter((item) => item.version !== version)];
  versions.latest = { ...(versions.latest || {}), [entry.site]: version };
  writeVersions(versions);
  return row;
}

module.exports = {
  VERSIONS_PATH,
  datasetVersion,
  readVersions,
  recordRun,
};
