#!/usr/bin/env npx tsx
/**
 * Custom HTML Dashboard Report Generator
 *
 * Reads Playwright's test-results.json and generates a clean HTML dashboard
 * showing: Total, Passed, Failed, Skipped, Retried, Duration per spec file.
 *
 * Usage:
 *   npx tsx helpers/generate-report.ts
 *   # or after adding to package.json scripts:
 *   npm run report:dashboard
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  status: string;
  duration: number;
  retry: number;
  error?: { message?: string };
}

interface TestCase {
  title: string;
  status: string;
  results: TestResult[];
}

interface Spec {
  title: string;
  tests: TestCase[];
  specs?: Spec[];
}

interface Suite {
  title: string;
  file?: string;
  suites?: Suite[];
  specs?: Spec[];
}

interface PlaywrightReport {
  stats: {
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
    duration: number;
    startTime: string;
  };
  suites: Suite[];
}

interface TestRow {
  file: string;
  section: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  retries: number;
  error?: string;
}

function collectTests(suite: Suite, parentFile = ''): TestRow[] {
  const rows: TestRow[] = [];
  const file = suite.file || parentFile;

  for (const child of suite.suites || []) {
    const section = child.title || '';
    for (const spec of child.specs || []) {
      for (const test of spec.tests || []) {
        const lastResult = test.results?.[test.results.length - 1];
        const totalDuration = test.results?.reduce((s, r) => s + r.duration, 0) || 0;
        const retries = test.results ? test.results.length - 1 : 0;

        let status: TestRow['status'] = 'passed';
        if (test.status === 'skipped') status = 'skipped';
        else if (test.status === 'unexpected') status = 'failed';
        else if (test.status === 'flaky') status = 'flaky';

        const errorMessage =
          status === 'failed' ? lastResult?.error?.message?.substring(0, 150) : undefined;

        rows.push({
          file: file.replace(/.*\//, ''),
          section: (section.split('@')[0] ?? section).trim(),
          name: spec.title,
          status,
          duration: totalDuration,
          retries,
          // Only set `error` when present — omitting it satisfies exactOptionalPropertyTypes.
          ...(errorMessage ? { error: errorMessage } : {}),
        });
      }
    }
    // Recurse into nested suites
    rows.push(...collectTests(child, file));
  }
  return rows;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function generateHTML(report: PlaywrightReport, rows: TestRow[]): string {
  const { stats } = report;
  const total = stats.expected + stats.unexpected + stats.skipped + stats.flaky;
  const passRate = total > 0 ? Math.round((stats.expected / total) * 100) : 0;
  const retriedCount = rows.filter(r => r.retries > 0).length;
  const runDate = new Date(stats.startTime).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  // Group by file
  const byFile = new Map<string, TestRow[]>();
  for (const row of rows) {
    const key = row.file || 'unknown';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(row);
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      case 'flaky': return '⚠️';
      default: return '❓';
    }
  };

  const statusClass = (s: string) => s;

  let testRows = '';
  for (const [file, fileRows] of byFile) {
    const filePassed = fileRows.filter(r => r.status === 'passed').length;
    const fileFailed = fileRows.filter(r => r.status === 'failed').length;
    const fileSkipped = fileRows.filter(r => r.status === 'skipped').length;
    const fileDuration = fileRows.reduce((s, r) => s + r.duration, 0);

    testRows += `
      <tr class="file-header">
        <td colspan="5">
          <strong>📄 ${file}</strong>
          <span class="file-stats">
            ${filePassed}P / ${fileFailed}F / ${fileSkipped}S — ${formatDuration(fileDuration)}
          </span>
        </td>
      </tr>`;

    for (const row of fileRows) {
      testRows += `
      <tr class="${statusClass(row.status)}">
        <td>${statusIcon(row.status)}</td>
        <td>${row.name}</td>
        <td class="status-cell ${row.status}">${row.status.toUpperCase()}</td>
        <td>${formatDuration(row.duration)}</td>
        <td>${row.retries > 0 ? `🔄 ${row.retries}` : '—'}</td>
      </tr>`;
      if (row.error) {
        testRows += `
      <tr class="error-row">
        <td></td>
        <td colspan="4" class="error-msg">${row.error.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      </tr>`;
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TMS Rider — Test Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; }
    .header { background: linear-gradient(135deg, #1a73e8, #0d47a1); color: white; padding: 30px 40px; }
    .header h1 { font-size: 24px; margin-bottom: 5px; }
    .header .subtitle { opacity: 0.85; font-size: 14px; }
    .summary { display: flex; gap: 20px; padding: 25px 40px; flex-wrap: wrap; }
    .card { background: white; border-radius: 12px; padding: 20px 25px; min-width: 150px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    .card .number { font-size: 36px; font-weight: 700; }
    .card .label { font-size: 12px; text-transform: uppercase; color: #666; margin-top: 4px; }
    .card.total .number { color: #1a73e8; }
    .card.passed .number { color: #0d9e0d; }
    .card.failed .number { color: #d93025; }
    .card.skipped .number { color: #f9a825; }
    .card.retried .number { color: #ff6d00; }
    .card.duration .number { color: #5f6368; font-size: 24px; }
    .card.rate .number { color: ${passRate >= 90 ? '#0d9e0d' : passRate >= 70 ? '#f9a825' : '#d93025'}; }
    .progress-bar { height: 6px; background: #e0e0e0; border-radius: 3px; margin: 20px 40px; overflow: hidden; }
    .progress-bar .fill { height: 100%; background: #0d9e0d; border-radius: 3px; transition: width 0.3s; }
    table { width: calc(100% - 80px); margin: 10px 40px 40px; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    th { background: #f8f9fa; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e0e0e0; }
    td { padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    tr:hover { background: #fafbfc; }
    tr.file-header { background: #f0f4ff; }
    tr.file-header td { padding: 8px 16px; font-size: 13px; }
    .file-stats { float: right; font-size: 12px; color: #666; font-weight: normal; }
    .status-cell { font-weight: 600; font-size: 11px; border-radius: 4px; padding: 3px 8px; display: inline-block; }
    .status-cell.passed { background: #e6f4ea; color: #137333; }
    .status-cell.failed { background: #fce8e6; color: #c5221f; }
    .status-cell.skipped { background: #fef7e0; color: #b06000; }
    .status-cell.flaky { background: #fff3e0; color: #e65100; }
    .error-row td { padding: 4px 16px 10px; }
    .error-msg { font-family: monospace; font-size: 11px; color: #c5221f; background: #fce8e6; padding: 6px 10px; border-radius: 4px; word-break: break-all; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚐 TMS Rider — Test Dashboard</h1>
    <div class="subtitle">Run: ${runDate} | Environment: ${process.env.ENV || 'staging'} | Duration: ${formatDuration(stats.duration)}</div>
  </div>

  <div class="summary">
    <div class="card total"><div class="number">${total}</div><div class="label">Total Tests</div></div>
    <div class="card passed"><div class="number">${stats.expected}</div><div class="label">Passed</div></div>
    <div class="card failed"><div class="number">${stats.unexpected}</div><div class="label">Failed</div></div>
    <div class="card skipped"><div class="number">${stats.skipped}</div><div class="label">Skipped</div></div>
    <div class="card retried"><div class="number">${retriedCount}</div><div class="label">Retried</div></div>
    <div class="card rate"><div class="number">${passRate}%</div><div class="label">Pass Rate</div></div>
    <div class="card duration"><div class="number">${formatDuration(stats.duration)}</div><div class="label">Duration</div></div>
  </div>

  <div class="progress-bar"><div class="fill" style="width: ${passRate}%"></div></div>

  <table>
    <thead>
      <tr>
        <th width="30"></th>
        <th>Test Name</th>
        <th width="80">Status</th>
        <th width="80">Duration</th>
        <th width="60">Retry</th>
      </tr>
    </thead>
    <tbody>
      ${testRows}
    </tbody>
  </table>

  <div class="footer">Generated by TMS Rider E2E Test Framework</div>
</body>
</html>`;
}

// Main
const reportPath = path.resolve(__dirname, '..', 'test-results.json');
if (!fs.existsSync(reportPath)) {
  console.error('❌ test-results.json not found. Run tests first: ./run-tests -e staging -u all --bc');
  process.exit(1);
}

const report: PlaywrightReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
const rows = report.suites.flatMap(s => collectTests(s));
const html = generateHTML(report, rows);

const outputPath = path.resolve(__dirname, '..', 'dashboard-report.html');
fs.writeFileSync(outputPath, html);
console.log(`✅ Dashboard generated: ${outputPath}`);
console.log(`   Total: ${report.stats.expected + report.stats.unexpected + report.stats.skipped} | Passed: ${report.stats.expected} | Failed: ${report.stats.unexpected} | Skipped: ${report.stats.skipped}`);
