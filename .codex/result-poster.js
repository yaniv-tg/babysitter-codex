/**
 * result-poster.js
 *
 * Posts task results and errors back to the babysitter SDK.
 * Handles large result files, retry logic, and schema validation.
 */

'use strict';

const { execFileSync } = require('child_process');
const { mkdirSync, writeFileSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');

const { readSessionContext } = require('./hooks/utils.js');

const LARGE_RESULT_THRESHOLD = 1 * 1024 * 1024; // 1 MiB
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a CLI command with retry logic and exponential backoff.
 * @param {string[]} args - Arguments to pass to npx
 * @param {number} retries - Number of retries remaining
 * @returns {{ stdout: string, success: boolean }}
 */
async function execWithRetry(args, retries) {
  if (retries === undefined) retries = MAX_RETRIES;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
    }
    try {
      const stdout = execFileSync(
        'npx',
        ['-y', '@a5c-ai/babysitter-sdk@0.0.173', ...args],
        { encoding: 'utf8' }
      );
      return { stdout, success: true };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        // Will retry
        continue;
      }
    }
  }
  throw lastError;
}

/**
 * Check if a result is large (>1 MiB) and handle accordingly.
 * Returns the path to use for the value flag.
 * @param {string} runDir
 * @param {string} effectId
 * @param {string} serialized - JSON string of the result
 * @returns {string} relative path for the value flag
 */
function writeResultData(runDir, effectId, serialized) {
  const byteLength = Buffer.byteLength(serialized, 'utf8');

  if (byteLength > LARGE_RESULT_THRESHOLD) {
    // Write to blobs directory
    const blobsDir = join(runDir, 'blobs');
    mkdirSync(blobsDir, { recursive: true });
    const blobPath = join(blobsDir, `${effectId}.json`);
    writeFileSync(blobPath, serialized, 'utf8');
    return `blobs/${effectId}.json`;
  }

  // Write to tasks/<effectId>/output.json
  const taskDir = join(runDir, 'tasks', effectId);
  mkdirSync(taskDir, { recursive: true });
  const outputPath = join(taskDir, 'output.json');
  writeFileSync(outputPath, serialized, 'utf8');
  return `tasks/${effectId}/output.json`;
}

/**
 * Post a successful task result back to babysitter.
 * @param {string} runDir - The run directory path
 * @param {string} effectId - The effect/task ID
 * @param {*} result - The result value to post
 * @param {object} [options={}] - Additional options
 * @param {string} [options.repoRoot] - Repository root for session context lookup
 * @returns {Promise<object>} Posting confirmation object
 */
async function postTaskResult(runDir, effectId, result, options) {
  if (!options) options = {};

  // Enrich result with session context if available
  const session = readSessionContext(options.repoRoot);
  if (session && session.sessionId) {
    result._sessionId = session.sessionId;
  }

  const serialized = JSON.stringify(result, null, 2);

  // Write result (handles large results automatically)
  const valuePath = writeResultData(runDir, effectId, serialized);

  // Call babysitter SDK
  const args = [
    'task:post',
    runDir,
    effectId,
    '--status', 'ok',
    '--value', valuePath,
    '--json',
  ];

  let stdout;
  try {
    ({ stdout } = await execWithRetry(args));
  } catch (err) {
    throw new Error(
      `Failed to post task result for effectId=${effectId} after ${MAX_RETRIES} retries: ${err.message}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (_) {
    parsed = { raw: stdout };
  }

  return {
    success: true,
    effectId,
    status: 'ok',
    valuePath,
    response: parsed,
  };
}

/**
 * Post a task error back to babysitter.
 * @param {string} runDir - The run directory path
 * @param {string} effectId - The effect/task ID
 * @param {Error|object} error - The error to post
 * @param {object} [options={}] - Additional options
 * @param {string} [options.repoRoot] - Repository root for session context lookup
 * @returns {Promise<object>} Error confirmation object
 */
async function postTaskError(runDir, effectId, error, options) {
  if (!options) options = {};

  const errorPayload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    code: error.code,
    details: error.details,
  };

  // Enrich with session context if available
  const session = readSessionContext(options.repoRoot);
  if (session && session.sessionId) {
    errorPayload._sessionId = session.sessionId;
  }

  const serialized = JSON.stringify(errorPayload, null, 2);

  // Write error to tasks/<effectId>/error.json
  const taskDir = join(runDir, 'tasks', effectId);
  mkdirSync(taskDir, { recursive: true });
  const errorPath = join(taskDir, 'error.json');
  writeFileSync(errorPath, serialized, 'utf8');

  const relativeErrorPath = `tasks/${effectId}/error.json`;

  const args = [
    'task:post',
    runDir,
    effectId,
    '--status', 'error',
    '--error', relativeErrorPath,
    '--json',
  ];

  let stdout;
  try {
    ({ stdout } = await execWithRetry(args));
  } catch (err) {
    throw new Error(
      `Failed to post task error for effectId=${effectId} after ${MAX_RETRIES} retries: ${err.message}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (_) {
    parsed = { raw: stdout };
  }

  return {
    success: true,
    effectId,
    status: 'error',
    errorPath: relativeErrorPath,
    response: parsed,
  };
}

/**
 * Validate a result against an output schema.
 * @param {*} result - The result to validate
 * @param {object} outputSchema - Schema describing expected fields and types
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateResult(result, outputSchema) {
  const errors = [];

  if (!outputSchema || typeof outputSchema !== 'object') {
    return { valid: true, errors: [] };
  }

  if (result === null || result === undefined || typeof result !== 'object') {
    errors.push(`Result must be an object, got: ${result === null ? 'null' : typeof result}`);
    return { valid: false, errors };
  }

  for (const [field, expectedValue] of Object.entries(outputSchema)) {
    const actualValue = result[field];

    // Check required fields exist
    if (!(field in result)) {
      errors.push(`Missing required field: "${field}"`);
      continue;
    }

    // Check types match (infer expected type from schema value)
    const expectedType = typeof expectedValue;
    const actualType = typeof actualValue;

    if (Array.isArray(expectedValue)) {
      if (!Array.isArray(actualValue)) {
        errors.push(`Field "${field}" expected Array, got ${actualType}`);
      }
    } else if (expectedType !== 'undefined' && actualType !== expectedType) {
      errors.push(
        `Field "${field}" expected type "${expectedType}", got "${actualType}"`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  postTaskResult,
  postTaskError,
  validateResult,
  readSessionContext,
};
