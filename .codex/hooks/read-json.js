#!/usr/bin/env node
'use strict';

/**
 * read-json.js
 *
 * CLI helper that safely extracts a value from a JSON file or stdin,
 * replacing fragile grep/sed patterns in shell scripts.
 *
 * Usage:
 *   node read-json.js <file> <key> [fallback-key ...]
 *   echo '{"a":1}' | node read-json.js - <key>
 *
 * Prints the value of the first matching key to stdout.
 * Exits 0 if found, 1 if not found.
 *
 * Example:
 *   node read-json.js session.json sessionId
 *   node read-json.js run-output.json runId id run_id
 */

const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  process.stderr.write('Usage: read-json.js <file-or--> <key> [fallback-key ...]\n');
  process.exit(1);
}

const filePath = args[0];
const keys = args.slice(1);

let raw;
try {
  if (filePath === '-') {
    raw = fs.readFileSync(0, 'utf8'); // stdin
  } else {
    raw = fs.readFileSync(filePath, 'utf8');
  }
} catch (err) {
  process.stderr.write(`[read-json] Cannot read ${filePath}: ${err.message}\n`);
  process.exit(1);
}

let obj;
try {
  obj = JSON.parse(raw);
} catch (err) {
  process.stderr.write(`[read-json] Invalid JSON in ${filePath}: ${err.message}\n`);
  process.exit(1);
}

for (const key of keys) {
  if (obj != null && obj[key] !== undefined && obj[key] !== null) {
    process.stdout.write(String(obj[key]));
    process.exit(0);
  }
}

process.exit(1);
