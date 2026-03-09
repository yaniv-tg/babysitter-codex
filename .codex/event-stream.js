'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const EVENT_VERSION = 'v1';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function eventsPath(repoRoot) {
  const root = repoRoot || process.cwd();
  return path.join(root, '.a5c', 'events', 'events.jsonl');
}

function emitEvent(eventType, payload, options = {}) {
  const root = options.repoRoot || process.cwd();
  const entry = {
    version: EVENT_VERSION,
    ts: new Date().toISOString(),
    type: eventType,
    payload: payload || {},
  };

  const p = eventsPath(root);
  ensureDir(path.dirname(p));
  fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

function notify(event) {
  const webhook = process.env.BABYSITTER_NOTIFY_WEBHOOK_URL;
  if (webhook) {
    try {
      fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(() => {});
    } catch {
      // best effort
    }
  }

  const slackWebhook = process.env.BABYSITTER_NOTIFY_SLACK_WEBHOOK;
  if (slackWebhook) {
    try {
      const text = `[babysitter] ${event.type} - ${JSON.stringify(event.payload).slice(0, 200)}`;
      fetch(slackWebhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    } catch {
      // best effort
    }
  }

  if (process.env.BABYSITTER_NOTIFY_DESKTOP === '1') {
    const msg = `babysitter: ${event.type}`;
    if (process.platform === 'darwin') {
      spawnSync('osascript', ['-e', `display notification "${msg}" with title "babysitter-codex"`], { stdio: 'ignore' });
    } else if (process.platform === 'linux') {
      spawnSync('notify-send', ['babysitter-codex', msg], { stdio: 'ignore' });
    } else if (process.platform === 'win32') {
      // Best effort no-op without external dependency.
    }
  }
}

module.exports = {
  EVENT_VERSION,
  emitEvent,
  notify,
};
