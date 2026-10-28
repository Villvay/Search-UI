import fs from 'fs';
import path from 'path';
import type { Finding, SecurityReviewReport, Severity } from './types';

export function writeSecurityReviewReports(
  report: SecurityReviewReport,
  jsonPath: string,
  htmlPath: string,
): void {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(htmlPath, renderHtml(report), 'utf8');
  printConsoleSummary(report, jsonPath, htmlPath);
}

export function findingsMatchingFailOn(
  findings: Finding[],
  failOn: 'none' | 'critical' | 'high' | 'medium' | 'all',
): Finding[] {
  if (failOn === 'none') return [];
  const rank: Record<Severity, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
    Informational: 0,
  };
  const min =
    failOn === 'critical' ? 4 : failOn === 'high' ? 3 : failOn === 'medium' ? 2 : 1;
  return findings.filter((finding) => rank[finding.severity] >= min && finding.confirmed);
}

function printConsoleSummary(
  report: SecurityReviewReport,
  jsonPath: string,
  htmlPath: string,
): void {
  const s = report.summary;
  console.log('\n========== Security review ==========');
  console.log(`Target:            ${s.baseURL}`);
  console.log(`Duration:          ${(s.durationMs / 1000).toFixed(1)}s`);
  console.log(`Pages visited:     ${s.pagesVisited}`);
  console.log(`Requests observed: ${s.requestsObserved}`);
  console.log(`Critical:          ${s.critical}`);
  console.log(`High:              ${s.high}`);
  console.log(`Medium:            ${s.medium}`);
  console.log(`Low:               ${s.low}`);
  console.log(`Informational:     ${s.informational}`);
  console.log(`Total findings:    ${s.total}`);
  console.log('');
  console.log(`JSON report: ${jsonPath}`);
  console.log(`HTML report: ${htmlPath}`);
  console.log('=====================================\n');
}

function renderHtml(report: SecurityReviewReport): string {
  const s = report.summary;
  const findings = report.findings
    .map(
      (finding) => `
      <article class="finding">
        <div class="finding-header">
          <h3>${esc(finding.title)}</h3>
          <span class="badge ${finding.severity.toLowerCase()}">${esc(finding.severity)}</span>
          ${finding.confirmed ? '' : '<span class="badge unverified">Potential</span>'}
        </div>
        <dl>
          <dt>Category</dt><dd>${esc(finding.category)}</dd>
          <dt>Description</dt><dd>${esc(finding.description)}</dd>
          <dt>Evidence</dt><dd class="mono">${esc(finding.evidence)}</dd>
          <dt>Affected</dt><dd>${finding.affectedUrls.map((url) => `<code>${esc(url)}</code>`).join('<br/>') || '—'}</dd>
          <dt>Why it matters</dt><dd>${esc(finding.whyItMatters)}</dd>
          <dt>Recommended fix</dt><dd>${esc(finding.recommendedFix)}</dd>
        </dl>
      </article>`,
    )
    .join('\n');

  const probeRows = report.probes
    .map(
      (probe) => `<tr>
        <td>${esc(probe.method)}</td>
        <td class="mono">${esc(probe.url)}</td>
        <td>${probe.status ?? ''}</td>
        <td>${esc(probe.contentType ?? '')}</td>
        <td>${esc(probe.error ?? '')}</td>
      </tr>`,
    )
    .join('\n');

  const cookieRows =
    report.cookies
      .map(
        (cookie) => `<tr>
          <td>${esc(cookie.name)}</td>
          <td>${esc(cookie.domain)}</td>
          <td>${cookie.secure ? 'yes' : 'no'}</td>
          <td>${cookie.httpOnly ? 'yes' : 'no'}</td>
          <td>${esc(cookie.sameSite || '')}</td>
        </tr>`,
      )
      .join('\n') || '<tr><td colspan="5">No cookies observed</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Security Review — ${esc(s.baseURL)}</title>
  <style>
    :root { --text:#1a1a1a; --muted:#555; --border:#d8dce3; --bg:#f4f6f9; --high:#991b1b; --medium:#92400e; --low:#065f46; --info:#1e40af; --crit:#7f1d1d; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--text); max-width: 960px; margin: 0 auto; padding: 48px 40px 72px; line-height: 1.55; font-size: 14px; }
    h1 { margin: 0 0 8px; font-size: 1.8rem; }
    h2 { margin: 36px 0 12px; border-bottom: 2px solid var(--border); padding-bottom: 6px; }
    .meta { color: var(--muted); margin-bottom: 24px; }
    .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0 28px; }
    .card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: center; }
    .card .count { font-size: 1.5rem; font-weight: 700; }
    .card.critical .count { color: var(--crit); } .card.high .count { color: var(--high); }
    .card.medium .count { color: var(--medium); } .card.low .count { color: var(--low); }
    .card.info .count { color: var(--info); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 12px 0 24px; }
    th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: var(--bg); }
    .finding { border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; margin: 14px 0; }
    .finding-header { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .finding-header h3 { margin: 0; flex: 1; font-size: 1rem; }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 8px 12px; margin: 12px 0 0; }
    dt { color: var(--muted); font-weight: 600; }
    dd { margin: 0; }
    .badge { display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; }
    .badge.critical { background: #fef2f2; color: var(--crit); }
    .badge.high { background: #fff1f2; color: var(--high); }
    .badge.medium { background: #fffbeb; color: var(--medium); }
    .badge.low { background: #ecfdf5; color: var(--low); }
    .badge.informational { background: #eff6ff; color: var(--info); }
    .badge.unverified { background: #f3f4f6; color: #4b5563; }
    .mono, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.86em; word-break: break-all; }
    code { background: #eef1f5; padding: 1px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Passive Security Review</h1>
  <p class="meta">
    Target: <code>${esc(s.baseURL)}</code><br/>
    Started: ${esc(s.startedAt)} &nbsp;|&nbsp; Duration: ${(s.durationMs / 1000).toFixed(1)}s<br/>
    Method: read-only observation (no exploits, brute force, or destructive requests)
  </p>
  <div class="cards">
    <div class="card critical"><div class="count">${s.critical}</div><div>Critical</div></div>
    <div class="card high"><div class="count">${s.high}</div><div>High</div></div>
    <div class="card medium"><div class="count">${s.medium}</div><div>Medium</div></div>
    <div class="card low"><div class="count">${s.low}</div><div>Low</div></div>
    <div class="card info"><div class="count">${s.informational}</div><div>Info</div></div>
  </div>
  <h2>TLS</h2>
  <table>
    <tr><th>Host</th><td>${esc(report.tls?.hostname ?? '')}</td></tr>
    <tr><th>Authorized</th><td>${report.tls?.authorized ? 'yes' : 'no'}</td></tr>
    <tr><th>Protocol</th><td>${esc(report.tls?.protocol ?? '')}</td></tr>
    <tr><th>Subject</th><td>${esc(report.tls?.subject ?? '')}</td></tr>
    <tr><th>Issuer</th><td>${esc(report.tls?.issuer ?? '')}</td></tr>
    <tr><th>Valid to</th><td>${esc(report.tls?.validTo ?? '')} (${report.tls?.daysRemaining ?? 'n/a'} days)</td></tr>
  </table>
  <h2>Findings (${s.total})</h2>
  ${findings || '<p>No findings recorded.</p>'}
  <h2>Public path probes</h2>
  <table>
    <thead><tr><th>Method</th><th>URL</th><th>Status</th><th>Type</th><th>Error</th></tr></thead>
    <tbody>${probeRows}</tbody>
  </table>
  <h2>Cookies</h2>
  <table>
    <thead><tr><th>Name</th><th>Domain</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th></tr></thead>
    <tbody>${cookieRows}</tbody>
  </table>
  <h2>Observed hosts</h2>
  <p>${report.networkHosts.map((host) => `<code>${esc(host)}</code>`).join(' ') || 'None'}</p>
</body>
</html>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
