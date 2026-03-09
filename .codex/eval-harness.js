'use strict';

const fs = require('fs');
const path = require('path');

function writeEvalResult(repoRoot, result) {
  const root = repoRoot || process.cwd();
  const out = path.join(root, '.a5c', 'eval', 'latest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
  return out;
}

function evaluateRun(metrics) {
  const quality = Number(metrics.quality || 0);
  const latencyMs = Number(metrics.latencyMs || 0);
  const costUsd = Number(metrics.costUsd || 0);
  const score = Math.max(0, Math.min(100, quality - costUsd * 10 - latencyMs / 10000));
  return { score, quality, latencyMs, costUsd };
}

module.exports = {
  writeEvalResult,
  evaluateRun,
};
