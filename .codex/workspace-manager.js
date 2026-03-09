'use strict';

const fs = require('fs');
const path = require('path');

function manifestPath(repoRoot) {
  return path.join(repoRoot || process.cwd(), '.a5c', 'workspace', 'repos.json');
}

function loadWorkspace(repoRoot) {
  const p = manifestPath(repoRoot);
  if (!fs.existsSync(p)) {
    return { version: 1, repos: [{ alias: 'default', path: repoRoot || process.cwd() }] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data || !Array.isArray(data.repos)) throw new Error('invalid');
    return data;
  } catch {
    return { version: 1, repos: [{ alias: 'default', path: repoRoot || process.cwd() }] };
  }
}

function resolveRepoPath(workspace, alias) {
  const a = alias || 'default';
  const found = (workspace.repos || []).find((r) => r.alias === a);
  return found ? found.path : null;
}

module.exports = {
  loadWorkspace,
  resolveRepoPath,
};
