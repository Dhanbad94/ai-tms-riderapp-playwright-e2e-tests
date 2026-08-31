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
  // Pass rate over EXECUTED tests only: skipped tests didn't run, so they don't
  // count for or against, and flaky tests are counted as passes (they ultimately
  // passed on retry). passRate = (passed + flaky) / (passed + failed + flaky).
  const executed = stats.expected + stats.unexpected + stats.flaky;
  const passRate = executed > 0 ? Math.round(((stats.expected + stats.flaky) / executed) * 100) : 0;
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

  // Escape a string for safe embedding inside an HTML text node.
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Escape a string for safe embedding inside a double-quoted HTML attribute.
  const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

  // Slug used to tie a file's header row to its test/error rows for group toggling.
  const fileId = (f: string) => f.replace(/[^a-z0-9]+/gi, '-');

  let testRows = '';
  let fileIndex = 0;
  for (const [file, fileRows] of byFile) {
    const filePassed = fileRows.filter(r => r.status === 'passed').length;
    const fileFailed = fileRows.filter(r => r.status === 'failed').length;
    const fileSkipped = fileRows.filter(r => r.status === 'skipped').length;
    const fileFlaky = fileRows.filter(r => r.status === 'flaky').length;
    const fileDuration = fileRows.reduce((s, r) => s + r.duration, 0);
    const fid = `${fileId(file)}-${fileIndex++}`;

    testRows += `
      <tr class="file-header" data-file="${fid}">
        <td colspan="5">
          <strong>📄 ${esc(file)}</strong>
          <span class="file-stats">
            ${filePassed}P / ${fileFailed}F / ${fileSkipped}S${fileFlaky ? ` / ${fileFlaky}⚠️` : ''} — ${formatDuration(fileDuration)}
          </span>
        </td>
      </tr>`;

    for (const row of fileRows) {
      // Lowercased haystack for the live text search (test name + status).
      const search = `${row.name} ${row.status}`.toLowerCase();
      const retried = row.retries > 0 ? '1' : '0';
      testRows += `
      <tr class="test-row ${statusClass(row.status)}" data-file="${fid}" data-row="test" data-status="${row.status}" data-retried="${retried}" data-search="${escAttr(search)}">
        <td>${statusIcon(row.status)}</td>
        <td>${esc(row.name)}</td>
        <td class="status-cell ${row.status}">${row.status.toUpperCase()}</td>
        <td>${formatDuration(row.duration)}</td>
        <td>${row.retries > 0 ? `🔄 ${row.retries}` : '—'}</td>
      </tr>`;
      if (row.error) {
        testRows += `
      <tr class="error-row" data-file="${fid}" data-row="error" data-status="${row.status}" data-retried="${retried}" data-search="${escAttr(search)}">
        <td></td>
        <td colspan="4" class="error-msg">${esc(row.error)}</td>
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
    /* Filter cards are clickable; show which one is active. */
    .card.clickable { cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s, box-shadow 0.15s; }
    .card.clickable:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.14); }
    .card.clickable.active { border-color: #1a73e8; box-shadow: 0 4px 14px rgba(26,115,232,0.25); }
    /* Controls: search box + filter chips. */
    .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 0 40px 4px; }
    .controls input[type="search"] { flex: 1 1 240px; min-width: 200px; padding: 10px 14px; font-size: 14px; border: 1px solid #d0d5dd; border-radius: 8px; outline: none; }
    .controls input[type="search"]:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.15); }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { cursor: pointer; user-select: none; padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 20px; border: 1px solid #d0d5dd; background: white; color: #555; transition: all 0.15s; }
    .chip:hover { border-color: #1a73e8; color: #1a73e8; }
    .chip.active { background: #1a73e8; border-color: #1a73e8; color: white; }
    .chip .cnt { opacity: 0.75; font-weight: 500; margin-left: 4px; }
    .visible-count { padding: 6px 40px 0; font-size: 12px; color: #888; }
    tr.no-match-row td { text-align: center; color: #999; padding: 24px; font-style: italic; }
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
    <div class="card total clickable active" data-filter="all"><div class="number">${total}</div><div class="label">Total Tests</div></div>
    <div class="card passed clickable" data-filter="passed"><div class="number">${stats.expected}</div><div class="label">Passed</div></div>
    <div class="card failed clickable" data-filter="failed"><div class="number">${stats.unexpected}</div><div class="label">Failed</div></div>
    <div class="card skipped clickable" data-filter="skipped"><div class="number">${stats.skipped}</div><div class="label">Skipped</div></div>
    <div class="card retried clickable" data-filter="retried"><div class="number">${retriedCount}</div><div class="label">Retried</div></div>
    <div class="card rate"><div class="number">${passRate}%</div><div class="label">Pass Rate</div></div>
    <div class="card duration"><div class="number">${formatDuration(stats.duration)}</div><div class="label">Duration</div></div>
  </div>

  <div class="progress-bar"><div class="fill" style="width: ${passRate}%"></div></div>

  <div class="controls">
    <input type="search" id="searchBox" placeholder="🔍 Search test name…" aria-label="Search test name">
    <div class="chips" id="filterChips">
      <span class="chip active" data-filter="all">All<span class="cnt">${total}</span></span>
      <span class="chip" data-filter="passed">✅ Passed<span class="cnt">${stats.expected}</span></span>
      <span class="chip" data-filter="failed">❌ Failed<span class="cnt">${stats.unexpected}</span></span>
      <span class="chip" data-filter="skipped">⏭️ Skipped<span class="cnt">${stats.skipped}</span></span>
      <span class="chip" data-filter="flaky">⚠️ Flaky<span class="cnt">${stats.flaky}</span></span>
      <span class="chip" data-filter="retried">🔄 Retried<span class="cnt">${retriedCount}</span></span>
    </div>
  </div>
  <div class="visible-count" id="visibleCount"></div>

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
      <tr class="no-match-row" id="noMatchRow" style="display:none"><td colspan="5">No tests match the current filter.</td></tr>
    </tbody>
  </table>

  <div class="footer">Generated by TMS Rider E2E Test Framework</div>

  <script>
    (function () {
      var searchBox = document.getElementById('searchBox');
      var noMatchRow = document.getElementById('noMatchRow');
      var visibleCount = document.getElementById('visibleCount');
      var testRows = Array.prototype.slice.call(document.querySelectorAll('tr[data-row="test"]'));
      var errorRows = Array.prototype.slice.call(document.querySelectorAll('tr[data-row="error"]'));
      var fileHeaders = Array.prototype.slice.call(document.querySelectorAll('tr.file-header'));
      var chips = Array.prototype.slice.call(document.querySelectorAll('#filterChips .chip'));
      var cards = Array.prototype.slice.call(document.querySelectorAll('.card.clickable'));

      var activeFilter = 'all';
      var query = '';

      // A row passes the status filter if the chosen bucket matches. 'retried'
      // keys off the data-retried flag; 'all' matches everything.
      function statusMatch(row) {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'retried') return row.getAttribute('data-retried') === '1';
        return row.getAttribute('data-status') === activeFilter;
      }
      function searchMatch(row) {
        return !query || row.getAttribute('data-search').indexOf(query) !== -1;
      }

      function apply() {
        var visible = 0;
        // Track which file groups still have at least one visible test row.
        var filesWithVisible = {};
        testRows.forEach(function (row) {
          var show = statusMatch(row) && searchMatch(row);
          row.style.display = show ? '' : 'none';
          if (show) { visible++; filesWithVisible[row.getAttribute('data-file')] = true; }
        });
        // Error detail rows follow their test row's visibility.
        errorRows.forEach(function (row) {
          var show = statusMatch(row) && searchMatch(row);
          row.style.display = show ? '' : 'none';
        });
        // Hide a file header when none of its tests are visible.
        fileHeaders.forEach(function (h) {
          h.style.display = filesWithVisible[h.getAttribute('data-file')] ? '' : 'none';
        });
        noMatchRow.style.display = visible === 0 ? '' : 'none';
        visibleCount.textContent = 'Showing ' + visible + ' of ' + testRows.length + ' tests';
      }

      function setFilter(f) {
        activeFilter = f;
        chips.forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-filter') === f); });
        cards.forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-filter') === f); });
        apply();
      }

      chips.forEach(function (c) {
        c.addEventListener('click', function () { setFilter(c.getAttribute('data-filter')); });
      });
      cards.forEach(function (c) {
        c.addEventListener('click', function () { setFilter(c.getAttribute('data-filter')); });
      });
      searchBox.addEventListener('input', function () {
        query = searchBox.value.trim().toLowerCase();
        apply();
      });

      apply();
    })();
  </script>
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
