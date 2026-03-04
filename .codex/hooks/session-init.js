#!/usr/bin/env node
'use strict';

/**
 * session-init.js
 * Codex lifecycle hook: initializes a babysitter session and stores the
 * session ID in .a5c/session.json relative to the repository root.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, '..', '..');
const A5C_DIR = path.join(REPO_ROOT, '.a5c');
const SESSION_FILE = path.join(A5C_DIR, 'session.json');

function main() {
  // Ensure .a5c directory exists
  fs.mkdirSync(A5C_DIR, { recursive: true });

  let output;
  try {
    output = execSync(
      'npx -y @a5c-ai/babysitter-sdk@0.0.173 session:init --json',
      { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }
    );
  } catch (err) {
    console.error('[session-init] Failed to call babysitter session:init:', err.message);
    process.exit(1);
  }

  let sessionData;
  try {
    sessionData = JSON.parse(output.trim());
  } catch (err) {
    console.error('[session-init] Failed to parse babysitter output as JSON:', err.message);
    console.error('[session-init] Raw output:', output);
    process.exit(1);
  }

  const sessionId = sessionData.sessionId || sessionData.id || sessionData.session_id;
  if (!sessionId) {
    console.error('[session-init] Could not extract session ID from babysitter output:', JSON.stringify(sessionData));
    process.exit(1);
  }

  const sessionRecord = {
    sessionId,
    createdAt: new Date().toISOString(),
    raw: sessionData,
  };

  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionRecord, null, 2) + '\n', 'utf8');
  console.log(`[session-init] Session initialized. ID: ${sessionId}`);
  console.log(`[session-init] Session data written to: ${SESSION_FILE}`);

  process.exit(0);
}

main();
