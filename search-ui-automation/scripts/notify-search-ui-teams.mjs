/**
 * Build / send a concise Microsoft Teams notification for Search UI smoke cycles.
 *
 * Uses Adaptive Card payload for Teams Workflow webhooks
 * ("Post to a channel when a webhook request is received").
 *
 * Coverage bullets are derived only from tests present in the cycle report
 * (no invented modules or assertions).
 *
 *   node scripts/notify-search-ui-teams.mjs --report=reports/search-ui-smoke-report.json --dry-run
 *   node scripts/notify-search-ui-teams.mjs --report=reports/search-ui-smoke-report.json
 *
 * Requires TEAMS_SEARCH_UI_WEBHOOK when not using --dry-run.
 * Never logs webhook URLs or secret values.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Human-readable smoke coverage keyed by report module + executed test IDs.
 * Only IDs that appear in the report contribute; modules with zero tests are omitted.
 */
/** Modules omitted from Teams coverage summary even if present in the report. */
const COVERAGE_OMIT_MODULES = new Set(['SORTING']);

const MODULE_COVERAGE = [
  {
    reportModule: 'ON-TYPE',
    label: 'On-Type',
    pointsFor(ids) {
      const points = [];
      if (ids.has('ON-TYPE-001')) {
        points.push('Search responds once the minimum query length is typed');
      }
      if (ids.has('ON-TYPE-003')) {
        points.push('Clearing the query resets on-type search state');
      }
      return consolidate(points, [
        'Search suggestions trigger correctly while typing and clear cleanly',
      ]);
    },
  },
  {
    reportModule: 'SUGGESTIONS',
    label: 'Suggestions',
    pointsFor(ids) {
      const points = [];
      if (ids.has('SUG-001')) {
        points.push('Empty search focus shows the trending dropdown');
      }
      if (ids.has('SUG-002')) {
        points.push('Valid queries display suggestion results');
      }
      return consolidate(points, [
        'Suggestion dropdown and query suggestions are validated',
      ]);
    },
  },
  {
    reportModule: 'ON-ENTER',
    label: 'On-Enter',
    pointsFor(ids) {
      const points = [];
      if (ids.has('ENTER-001')) {
        points.push('Enter submits a valid search');
      }
      if (ids.has('ENTER-002')) {
        points.push('Search URL retains the submitted query');
      }
      return consolidate(points, [
        'Enter submission navigates to search results with the correct query',
      ]);
    },
  },
  {
    reportModule: 'TRENDING NOW',
    label: 'Trending Now',
    pointsFor(ids) {
      const points = [];
      if (ids.has('TREND-001') || ids.has('TREND-002')) {
        points.push('Trending Now queries are displayed on empty focus');
      }
      if (ids.has('TREND-004')) {
        points.push('Clicking a trending query opens the correct search results');
      }
      return consolidate(points, [
        'Trending queries are displayed and navigate to the correct SERP',
      ]);
    },
  },
  {
    reportModule: 'RECENT SEARCHES',
    label: 'Your Recent Searches',
    pointsFor(ids) {
      const points = [];
      if (ids.has('RECENT-001') || ids.has('RECENT-002')) {
        points.push('Recent search history is displayed');
      }
      if (ids.has('RECENT-005')) {
        points.push('Clicking a recent search opens the correct SERP');
      }
      if (ids.has('RECENT-007')) {
        points.push('Individual recent searches can be removed');
      }
      return consolidate(points, [
        'Recent history is displayed, selectable, and removable',
      ]);
    },
  },
  {
    reportModule: 'FILTERS & FACETS',
    label: 'Filters & Facets',
    pointsFor(ids) {
      const points = [];
      if (ids.has('FILTER-001') || ids.has('FILTER-002')) {
        points.push('Filters panel and facet groups are displayed on SERP');
      }
      if (ids.has('FILTER-004')) {
        points.push('Selecting a filter shows the selected state');
      }
      if (ids.has('FILTER-005')) {
        points.push('Applying a filter updates search results');
      }
      return consolidate(points, [
        'Filters apply correctly and update search state/results',
      ]);
    },
  },
  {
    reportModule: 'RUNTIME ERRORS',
    label: 'Runtime Errors',
    pointsFor(ids) {
      const points = [];
      if (ids.has('RUNTIME-001') || ids.has('RUNTIME-002') || ids.has('RUNTIME-003')) {
        points.push(
          'Unexpected console, page, and interaction runtime errors are monitored',
        );
      }
      return points;
    },
  },
  {
    reportModule: 'CACHE & STATE',
    label: 'Cache & Search State',
    pointsFor(ids) {
      const points = [];
      if (
        ids.has('CACHE-001') ||
        ids.has('CACHE-002') ||
        ids.has('CACHE-003') ||
        ids.has('CACHE-006') ||
        ids.has('CACHE-008')
      ) {
        points.push(
          'Search state stays consistent across query changes, refresh, URL sync, and clear',
        );
      }
      return points;
    },
  },
  {
    reportModule: 'SEARCH INPUT ROBUSTNESS',
    label: 'Search Input Robustness',
    pointsFor(ids) {
      const points = [];
      if (ids.has('INPUT-001')) {
        points.push('Normal query baseline is handled safely');
      }
      if (ids.has('INPUT-007') || ids.has('INPUT-008')) {
        points.push('HTML-like and JavaScript-like input is treated as plain text');
      }
      return consolidate(points, [
        'Normal and special/HTML/JS-like inputs are handled safely',
      ]);
    },
  },
  {
    reportModule: 'RELATED SEARCHES',
    label: 'Related Searches',
    pointsFor(ids) {
      // Related Searches is excluded from current smoke; only show if tests ran.
      if (!ids.size) return [];
      return ['Related Searches smoke coverage executed'];
    },
  },
];

function consolidate(detailPoints, rolledUp) {
  if (detailPoints.length <= 3) return detailPoints;
  return rolledUp;
}

function parseArgs(argv) {
  const out = {
    reportRel: 'reports/search-ui-smoke-report.json',
    dryRun: false,
    runUrl: process.env.SMOKE_RUN_URL || '',
    artifactName: process.env.SMOKE_ARTIFACT_NAME || 'search-ui-smoke-reports',
  };
  for (const arg of argv) {
    if (arg.startsWith('--report=')) out.reportRel = arg.slice('--report='.length);
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--run-url=')) out.runUrl = arg.slice('--run-url='.length);
    else if (arg.startsWith('--artifact-name='))
      out.artifactName = arg.slice('--artifact-name='.length);
    // --dashboard-url retained for backward compatibility but ignored (no Pages).
  }
  return out;
}

function fmtDuration(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return 'n/a';
  const n = Number(ms);
  if (n < 1000) return `${Math.round(n)}ms`;
  if (n < 60000) return `${(n / 1000).toFixed(1)}s`;
  const m = Math.floor(n / 60000);
  const s = Math.round((n % 60000) / 1000);
  return `${m}m ${s}s`;
}

function cycleOutcome(cycle) {
  const result = cycle?.result || '';
  if (result === 'FAILED' || result === 'FAIL') {
    return { label: 'FAIL', color: 'Attention' };
  }
  if (result === 'PASS (KNOWN DEFECTS)') {
    return { label: 'PASS — Known Defects', color: 'Warning' };
  }
  return { label: 'PASS', color: 'Good' };
}

function shortDefectReason(t) {
  return (t.knownDefectReason || t.error || t.errorMessage || 'known defect')
    .split('\n')[0]
    .slice(0, 140);
}

/**
 * Build coverage sections only for modules that actually executed in this report.
 */
function buildCoverageSections(report) {
  const tests = report.tests || [];
  const byModule = new Map();

  for (const t of tests) {
    const mod = t.module || 'OTHER';
    if (!byModule.has(mod)) {
      byModule.set(mod, {
        tests: [],
        ids: new Set(),
        known: [],
        failed: [],
      });
    }
    const bucket = byModule.get(mod);
    bucket.tests.push(t);
    if (t.testId) bucket.ids.add(String(t.testId).toUpperCase());
    if (t.cycleStatus === 'KNOWN DEFECT' || t.knownDefect) bucket.known.push(t);
    else if (t.status === 'failed') bucket.failed.push(t);
  }

  const sections = [];
  const seen = new Set();

  for (const meta of MODULE_COVERAGE) {
    if (COVERAGE_OMIT_MODULES.has(meta.reportModule)) continue;
    const bucket = byModule.get(meta.reportModule);
    if (!bucket || bucket.tests.length === 0) continue;
    seen.add(meta.reportModule);

    const points = meta.pointsFor(bucket.ids);
    // Fallback: derive short lines from titles if mapping missed IDs.
    const coveragePoints =
      points.length > 0
        ? points.slice(0, 3)
        : bucket.tests.slice(0, 3).map((t) => readableTitle(t));

    for (const t of bucket.known) {
      coveragePoints.push(
        `Known defect: ${t.testId || 'unknown'} — ${shortDefectReason(t)}`,
      );
    }
    for (const t of bucket.failed.slice(0, 3)) {
      coveragePoints.push(
        `Unexpected failure: ${t.testId || t.title || 'unknown'}`,
      );
    }

    sections.push({
      module: meta.reportModule,
      label: meta.label,
      points: coveragePoints,
    });
  }

  // Any executed module not in the catalog (should be rare).
  for (const [mod, bucket] of byModule.entries()) {
    if (seen.has(mod) || COVERAGE_OMIT_MODULES.has(mod) || bucket.tests.length === 0) {
      continue;
    }
    const points = bucket.tests.slice(0, 3).map((t) => readableTitle(t));
    for (const t of bucket.known) {
      points.push(`Known defect: ${t.testId || 'unknown'} — ${shortDefectReason(t)}`);
    }
    for (const t of bucket.failed.slice(0, 3)) {
      points.push(`Unexpected failure: ${t.testId || t.title || 'unknown'}`);
    }
    sections.push({
      module: mod,
      label: mod,
      points,
    });
  }

  return sections;
}

function readableTitle(t) {
  const raw = String(t.scenario || t.title || t.testId || 'coverage').trim();
  const stripped = raw
    .replace(/^[A-Z]+-\d+(?:\s+@\S+)*\s*-\s*/i, '')
    .replace(/@\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || raw;
}

function buildTextMessage(report, opts) {
  const cycle = report.cycle || {};
  const counts = cycle.counts || {};
  const env = cycle.environment || 'QA';
  const outcome = cycleOutcome(cycle);
  const projects = (cycle.projects || ['desktop-1440']).join(', ');
  const runUrl = (opts.runUrl || '').trim();
  const total = counts.total ?? 0;
  const passed = counts.passed ?? 0;
  const failed = counts.failed ?? 0;
  const skipped = counts.skipped ?? 0;
  const knownDefects = counts.knownDefects ?? 0;
  const unexpected = counts.unexpectedFailures ?? failed;

  const lines = [];
  lines.push(`Search UI Daily Smoke — ${env}`);
  lines.push('');
  lines.push(outcome.label);
  lines.push('');
  lines.push(`${passed}/${total} passed`);
  lines.push(`${failed} failed`);
  lines.push(`${skipped} skipped`);
  lines.push(`${knownDefects} known defects`);
  if (unexpected > 0) lines.push(`${unexpected} unexpected failures`);
  lines.push(`Duration: ${fmtDuration(cycle.wallClockMs)}`);
  lines.push('');
  lines.push(`Browser: ${cycle.browser || 'Chromium'}`);
  lines.push(`Viewport: ${projects}`);

  const coverage = buildCoverageSections(report);
  if (coverage.length) {
    lines.push('');
    lines.push('Coverage:');
    for (const section of coverage) {
      lines.push(section.label);
      for (const point of section.points) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }
  }

  lines.push(
    `Detailed report: Download \`search-ui-smoke-dashboard.html\` from the workflow artifacts (\`${opts.artifactName}\`).`,
  );
  if (runUrl) {
    lines.push(`View GitHub Actions Run: ${runUrl}`);
  } else {
    lines.push('View GitHub Actions Run: (unavailable outside CI)');
  }

  return lines.join('\n').trimEnd();
}

function buildAdaptiveCard(report, opts) {
  const cycle = report.cycle || {};
  const counts = cycle.counts || {};
  const env = cycle.environment || 'QA';
  const outcome = cycleOutcome(cycle);
  const projects = (cycle.projects || ['desktop-1440']).join(', ');
  const runUrl = (opts.runUrl || '').trim();
  const total = counts.total ?? 0;
  const passed = counts.passed ?? 0;
  const failed = counts.failed ?? 0;
  const skipped = counts.skipped ?? 0;
  const knownDefects = counts.knownDefects ?? 0;
  const unexpected = counts.unexpectedFailures ?? failed;

  const facts = [
    { title: 'Result', value: `${passed}/${total} passed` },
    { title: 'Failed', value: String(failed) },
    { title: 'Skipped', value: String(skipped) },
    { title: 'Known defects', value: String(knownDefects) },
  ];
  if (unexpected > 0) {
    facts.push({ title: 'Unexpected failures', value: String(unexpected) });
  }
  facts.push(
    { title: 'Duration', value: fmtDuration(cycle.wallClockMs) },
    { title: 'Environment', value: env },
    { title: 'Browser', value: cycle.browser || 'Chromium' },
    { title: 'Viewport', value: projects },
  );

  const body = [
    {
      type: 'TextBlock',
      size: 'Large',
      weight: 'Bolder',
      text: `Search UI Daily Smoke — ${env}`,
      wrap: true,
    },
    {
      type: 'TextBlock',
      size: 'Medium',
      weight: 'Bolder',
      text: outcome.label,
      color: outcome.color,
      wrap: true,
      spacing: 'Small',
    },
    {
      type: 'FactSet',
      facts,
      spacing: 'Medium',
    },
  ];

  const coverage = buildCoverageSections(report);
  if (coverage.length) {
    body.push({
      type: 'TextBlock',
      weight: 'Bolder',
      text: 'Coverage',
      spacing: 'Medium',
      wrap: true,
    });
    for (const section of coverage) {
      body.push({
        type: 'TextBlock',
        weight: 'Bolder',
        text: section.label,
        spacing: 'Small',
        wrap: true,
      });
      body.push({
        type: 'TextBlock',
        text: section.points.map((p) => `- ${p}`).join('\n'),
        wrap: true,
        spacing: 'None',
      });
    }
  }

  body.push({
    type: 'TextBlock',
    text: `Detailed report: Download \`search-ui-smoke-dashboard.html\` from the workflow artifacts (\`${opts.artifactName}\`).`,
    wrap: true,
    spacing: 'Medium',
  });

  const actions = [];
  if (runUrl) {
    actions.push({
      type: 'Action.OpenUrl',
      title: 'View GitHub Actions Run',
      url: runUrl,
    });
    actions.push({
      type: 'Action.OpenUrl',
      title: 'Open run artifacts',
      url: `${runUrl.replace(/#.*$/, '')}#artifacts`,
    });
  }

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    msteams: { width: 'Full' },
    body,
    actions,
  };
}

function buildTeamsPayload(report, opts) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.teams.card.adaptive',
        contentUrl: null,
        content: buildAdaptiveCard(report, opts),
      },
    ],
  };
}

async function postWebhook(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Teams webhook failed: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = path.resolve(root, args.reportRel);
  if (!fs.existsSync(reportPath)) {
    console.error(`Missing report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const ci = report.cycle?.ci || {};
  const runUrl =
    args.runUrl ||
    ci.runUrl ||
    (ci.repository && ci.runId
      ? `${(ci.serverUrl || 'https://github.com').replace(/\/$/, '')}/${ci.repository}/actions/runs/${ci.runId}`
      : '');

  const opts = {
    runUrl,
    artifactName: args.artifactName || ci.artifactName || 'search-ui-smoke-reports',
  };

  const text = buildTextMessage(report, opts);
  const payload = buildTeamsPayload(report, opts);

  if (args.dryRun) {
    console.log('=== Teams notification (dry-run text) ===');
    console.log(text);
    console.log('\n=== Teams Workflow Adaptive Card payload (secrets redacted) ===');
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  const webhook = process.env.TEAMS_SEARCH_UI_WEBHOOK?.trim();
  if (!webhook) {
    console.error(
      'TEAMS_SEARCH_UI_WEBHOOK is not set. Configure the GitHub Actions secret to enable Teams delivery.',
    );
    process.exit(1);
  }

  await postWebhook(webhook, payload);
  console.log('Teams smoke notification sent (Adaptive Card / Workflow webhook).');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
