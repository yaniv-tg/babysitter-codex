'use strict';

const fs = require('fs');
const path = require('path');
const { fetchIssue } = require('./github-workflow');
const { findSession } = require('./state-index');

function policyPath(repoRoot) {
  return path.join(repoRoot || process.cwd(), '.a5c', 'config', 'model-policy.json');
}

function readPolicy(repoRoot) {
  const p = policyPath(repoRoot);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writePolicy(repoRoot, policy) {
  const p = policyPath(repoRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(policy, null, 2), 'utf8');
}

function parseModelArgs(args) {
  const trimmed = String(args || '').trim();
  if (!trimmed || trimmed === 'show') return { action: 'show', pairs: [] };

  if (!trimmed.startsWith('set')) {
    return { action: 'invalid', error: 'Use "show" or "set <phase>=<model> ..."' };
  }

  const pairs = trimmed
    .slice(3)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const i = token.indexOf('=');
      if (i <= 0) return null;
      return { phase: token.slice(0, i), model: token.slice(i + 1) };
    })
    .filter(Boolean);

  if (pairs.length === 0) {
    return { action: 'invalid', error: 'No phase=model pairs provided.' };
  }

  return { action: 'set', pairs };
}

function handleModelCommand(args, options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const parsed = parseModelArgs(args);
  if (parsed.action === 'invalid') {
    return {
      ok: false,
      action: 'set',
      applied: false,
      policy: readPolicy(repoRoot),
      notes: [parsed.error],
    };
  }

  if (parsed.action === 'show') {
    return {
      ok: true,
      action: 'show',
      applied: false,
      policy: readPolicy(repoRoot),
      notes: ['Loaded current model routing policy.'],
    };
  }

  const validPhases = new Set(['plan', 'execute', 'review', 'fix']);
  const policy = readPolicy(repoRoot);
  const notes = [];
  for (const p of parsed.pairs) {
    if (!validPhases.has(p.phase)) {
      notes.push(`Ignored invalid phase "${p.phase}"`);
      continue;
    }
    policy[p.phase] = p.model;
  }
  writePolicy(repoRoot, policy);

  return {
    ok: true,
    action: 'set',
    applied: true,
    policy,
    notes: notes.length > 0 ? notes : ['Model routing policy updated.'],
  };
}

function inferRepoFromGitRemote(repoRoot) {
  const p = path.join(repoRoot || process.cwd(), '.git', 'config');
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const m = text.match(/url\s*=\s*https:\/\/github\.com\/([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/m);
  return m ? m[1] : null;
}

function parseIssueArgs(args) {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: 'Issue number or URL is required.' };

  let issueToken = tokens[0];
  let repo = null;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === '--repo' && tokens[i + 1]) {
      repo = tokens[i + 1];
      i += 1;
    }
  }

  const urlMatch = issueToken.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
  if (urlMatch) {
    return { ok: true, repo: repo || urlMatch[1], issueNumber: Number(urlMatch[2]) };
  }

  const n = Number(issueToken);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, error: `Invalid issue identifier: ${issueToken}` };
  }
  return { ok: true, repo, issueNumber: n };
}

function handleIssueCommand(args, options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const parsed = parseIssueArgs(args);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const repo = parsed.repo || inferRepoFromGitRemote(repoRoot);
  if (!repo) {
    return { ok: false, error: 'Could not infer GitHub repo. Pass --repo owner/name.' };
  }

  const fetched = fetchIssue(repo, parsed.issueNumber);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error, issue: { number: parsed.issueNumber, repo } };
  }

  const issue = fetched.issue;
  const plan = [
    `Understand issue #${issue.number}: ${issue.title}`,
    'Create minimal reproducible test covering the reported behavior',
    'Implement fix behind compatibility-safe defaults',
    'Run tests and summarize regression risk',
  ];

  return {
    ok: true,
    issue,
    plan,
    mode: 'plan',
    nextAction: `babysitter call implement issue #${issue.number}: ${issue.title}`,
  };
}

function handleResumeSelector(args, options = {}) {
  const selector = String(args || '').trim() || 'recent';
  const repoRoot = options.repoRoot || process.cwd();
  const session = findSession(repoRoot, selector);
  if (!session) {
    return {
      ok: false,
      selector,
      error: `No session found for selector "${selector}"`,
    };
  }
  return {
    ok: true,
    selector,
    session,
    nextAction: `babysitter session:resume --session-id ${session.sessionId} --state-dir .a5c --run-id ${session.lastRunId || '<runId>'} --json`,
  };
}

module.exports = {
  handleModelCommand,
  handleIssueCommand,
  handleResumeSelector,
};
