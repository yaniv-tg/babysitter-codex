'use strict';

const { spawnSync } = require('child_process');

function fetchIssue(repo, number) {
  const res = spawnSync(
    process.platform === 'win32' ? 'gh.exe' : 'gh',
    ['issue', 'view', String(number), '--repo', repo, '--json', 'number,title,body,state,url,labels'],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) {
    return { ok: false, error: String(res.stderr || res.stdout || 'gh issue view failed') };
  }
  try {
    return { ok: true, issue: JSON.parse(String(res.stdout || '{}')) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  fetchIssue,
};
