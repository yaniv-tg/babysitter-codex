'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function indexPath(repoRoot) {
  return path.join(repoRoot || process.cwd(), '.a5c', 'index', 'sessions.json');
}

function loadIndex(repoRoot) {
  const p = indexPath(repoRoot);
  if (!fs.existsSync(p)) return { version: 1, sessions: [] };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data || !Array.isArray(data.sessions)) return { version: 1, sessions: [] };
    return data;
  } catch {
    return { version: 1, sessions: [] };
  }
}

function saveIndex(repoRoot, data) {
  const p = indexPath(repoRoot);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function registerSession(repoRoot, session) {
  const data = loadIndex(repoRoot);
  const now = new Date().toISOString();
  const existing = data.sessions.find((s) => s.sessionId === session.sessionId);
  if (existing) {
    existing.updatedAt = now;
    existing.lastRunId = session.runId || existing.lastRunId || null;
    existing.tags = Array.from(new Set([...(existing.tags || []), ...(session.tags || [])]));
    if (session.alias) existing.alias = session.alias;
  } else {
    data.sessions.push({
      sessionId: session.sessionId,
      alias: session.alias || null,
      tags: session.tags || [],
      createdAt: now,
      updatedAt: now,
      lastRunId: session.runId || null,
    });
  }
  saveIndex(repoRoot, data);
  return data;
}

function findSession(repoRoot, selector) {
  const data = loadIndex(repoRoot);
  const token = String(selector || '').trim();
  if (!token || token === 'recent') {
    return [...data.sessions].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
  }
  if (token.startsWith('tag:')) {
    const tag = token.slice(4);
    return [...data.sessions]
      .filter((s) => (s.tags || []).includes(tag))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
  }
  return data.sessions.find((s) => s.alias === token || s.sessionId === token) || null;
}

module.exports = {
  loadIndex,
  saveIndex,
  registerSession,
  findSession,
};
