/**
 * Build / send a concise Microsoft Teams notification for Search UI smoke cycles.
 *
 * Uses Adaptive Card payload for Teams Workflow webhooks
 * ("Post to a channel when a webhook request is received").
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

function parseArgs(argv) {
  const out = {
    reportRel: 'reports/search-ui-smoke-report.json',
    dryRun: false,
    runUrl: process.env.SMOKE_RUN_URL || '',
    dashboardUrl: process.env.SMOKE_DASHBOARD_URL || '',
    artifactName: process.env.SMOKE_ARTIFACT_NAME || 'search-ui-smoke-reports',
  };
  for (const arg of argv) {
    if (arg.startsWith('--report=')) out.reportRel = arg.slice('--report='.length);
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--run-url=')) out.runUrl = arg.slice('--run-url='.length);
    else if (arg.startsWith('--dashboard-url='))
      out.dashboardUrl = arg.slice('--dashboard-url='.length);
    else if (arg.startsWith('--artifact-name='))
      out.artifactName = arg.slice('--artifact-name='.length);
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
    return {
      label: 'FAIL',
      emoji: '🔴',
      color: 'Attention',
    };
  }
  if (result === 'PASS (KNOWN DEFECTS)') {
    return {
      label: 'PASS — Known Defects',
      emoji: '🟢',
      color: 'Warning',
    };
  }
  return {
    label: 'PASS',
    emoji: '🟢',
    color: 'Good',
  };
}

function resolveLinks(opts) {
  const runUrl = (opts.runUrl || '').trim();
  let dashboardUrl = (opts.dashboardUrl || '').trim();

  // Artifact / run tabs are not viewable HTML — never treat them as the dashboard.
  const runBase = runUrl.replace(/#.*$/, '');
  const dashBase = dashboardUrl.replace(/#.*$/, '');
  if (
    !dashboardUrl ||
    dashboardUrl.includes('#artifacts') ||
    (runBase && dashBase === runBase)
  ) {
    dashboardUrl = '';
  }

  return { runUrl, dashboardUrl };
}

function buildTextMessage(report, opts) {
  const cycle = report.cycle || {};
  const counts = cycle.counts || {};
  const env = cycle.environment || 'QA';
  const outcome = cycleOutcome(cycle);
  const projects = (cycle.projects || ['desktop-1440']).join(', ');
  const { runUrl, dashboardUrl } = resolveLinks(opts);
  const lines = [];
  lines.push(`🔍 Search UI Daily Smoke — ${env}`);
  lines.push('');
  lines.push(`${outcome.emoji} ${outcome.label}`);
  lines.push('');
  lines.push(`Total: ${counts.total ?? 'n/a'}`);
  lines.push(`Passed: ${counts.passed ?? 'n/a'}`);
  lines.push(`Failed: ${counts.failed ?? 'n/a'}`);
  lines.push(`Skipped: ${counts.skipped ?? 'n/a'}`);
  lines.push(`Known Defects: ${counts.knownDefects ?? 'n/a'}`);
  if ((counts.unexpectedFailures ?? counts.failed ?? 0) > 0) {
    lines.push(`Unexpected Failures: ${counts.unexpectedFailures ?? counts.failed}`);
  }
  lines.push(`Duration: ${fmtDuration(cycle.wallClockMs)}`);
  lines.push('');
  lines.push(`Browser: ${cycle.browser || 'Chromium'}`);
  lines.push(`Viewport: ${projects}`);

  const known = (report.tests || []).filter((t) => t.cycleStatus === 'KNOWN DEFECT');
  if (known.length) {
    lines.push('');
    lines.push('Known Defect:');
    for (const t of known.slice(0, 5)) {
      const reason = (t.knownDefectReason || t.error || 'known defect').split('\n')[0];
      lines.push(`${t.testId} — ${reason.slice(0, 120)}`);
    }
  }

  const failed = (report.tests || []).filter(
    (t) => t.status === 'failed' && t.cycleStatus !== 'KNOWN DEFECT',
  );
  if (failed.length) {
    lines.push('');
    lines.push('Failed Tests:');
    for (const t of failed.slice(0, 8)) {
      lines.push(`• ${t.testId || t.title || 'unknown'}`);
    }
  }

  lines.push('');
  if (dashboardUrl) {
    lines.push(`📊 View Detailed Dashboard: ${dashboardUrl}`);
  } else {
    lines.push(
      `📊 View Detailed Dashboard: unavailable (publish HTML to GitHub Pages; artifact zip is not a browser URL)`,
    );
  }
  if (runUrl) {
    lines.push(`🔗 View GitHub Actions Run: ${runUrl}`);
  } else {
    lines.push('🔗 View GitHub Actions Run: (unavailable outside CI)');
  }

  return lines.join('\n');
}

/**
 * Adaptive Card wrapped for Teams Workflow HTTP webhook triggers.
 * @see https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using
 */
function buildAdaptiveCard(report, opts) {
  const cycle = report.cycle || {};
  const counts = cycle.counts || {};
  const env = cycle.environment || 'QA';
  const outcome = cycleOutcome(cycle);
  const projects = (cycle.projects || ['desktop-1440']).join(', ');
  const { runUrl, dashboardUrl } = resolveLinks(opts);

  const facts = [
    { title: 'Total', value: String(counts.total ?? 'n/a') },
    { title: 'Passed', value: String(counts.passed ?? 'n/a') },
    { title: 'Failed', value: String(counts.failed ?? 'n/a') },
    { title: 'Skipped', value: String(counts.skipped ?? 'n/a') },
    { title: 'Known Defects', value: String(counts.knownDefects ?? 'n/a') },
  ];
  if ((counts.unexpectedFailures ?? counts.failed ?? 0) > 0) {
    facts.push({
      title: 'Unexpected Failures',
      value: String(counts.unexpectedFailures ?? counts.failed),
    });
  }
  facts.push(
    { title: 'Duration', value: fmtDuration(cycle.wallClockMs) },
    { title: 'Browser', value: cycle.browser || 'Chromium' },
    { title: 'Viewport', value: projects },
  );

  const body = [
    {
      type: 'TextBlock',
      size: 'Large',
      weight: 'Bolder',
      text: `🔍 Search UI Daily Smoke — ${env}`,
      wrap: true,
    },
    {
      type: 'TextBlock',
      size: 'Medium',
      weight: 'Bolder',
      text: `${outcome.emoji} ${outcome.label}`,
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

  const known = (report.tests || []).filter((t) => t.cycleStatus === 'KNOWN DEFECT');
  if (known.length) {
    body.push({
      type: 'TextBlock',
      weight: 'Bolder',
      text: 'Known Defect',
      spacing: 'Medium',
      wrap: true,
    });
    body.push({
      type: 'TextBlock',
      text: known
        .slice(0, 5)
        .map((t) => {
          const reason = (t.knownDefectReason || t.error || 'known defect')
            .split('\n')[0]
            .slice(0, 120);
          return `• **${t.testId}** — ${reason}`;
        })
        .join('\n'),
      wrap: true,
    });
  }

  const failed = (report.tests || []).filter(
    (t) => t.status === 'failed' && t.cycleStatus !== 'KNOWN DEFECT',
  );
  if (failed.length) {
    body.push({
      type: 'TextBlock',
      weight: 'Bolder',
      text: 'Failed Tests',
      color: 'Attention',
      spacing: 'Medium',
      wrap: true,
    });
    body.push({
      type: 'TextBlock',
      text: failed
        .slice(0, 8)
        .map((t) => `• ${t.testId || t.title || 'unknown'}`)
        .join('\n'),
      wrap: true,
    });
  }

  if (!dashboardUrl) {
    body.push({
      type: 'TextBlock',
      text: runUrl
        ? 'HTML dashboard link unavailable until GitHub Pages publish succeeds. Download `search-ui-smoke-dashboard.html` from the Actions run artifacts if needed.'
        : `Dashboard artifact: \`${opts.artifactName}\` → search-ui-smoke-dashboard.html`,
      isSubtle: true,
      wrap: true,
      spacing: 'Medium',
    });
  }

  const actions = [];
  if (dashboardUrl) {
    actions.push({
      type: 'Action.OpenUrl',
      title: '📊 View Detailed Dashboard',
      url: dashboardUrl,
    });
  }
  if (runUrl) {
    actions.push({
      type: 'Action.OpenUrl',
      title: '🔗 View GitHub Actions Run',
      url: runUrl,
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

/** Workflow webhook envelope expected by Teams Power Automate HTTP triggers. */
function buildTeamsPayload(report, opts) {
  const card = buildAdaptiveCard(report, opts);
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.teams.card.adaptive',
        contentUrl: null,
        content: card,
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
  const dashboardUrl = args.dashboardUrl || ci.dashboardUrl || '';

  const opts = {
    runUrl,
    dashboardUrl,
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
