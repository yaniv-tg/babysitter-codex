'use strict';

/**
 * session-manager.js
 *
 * Full session lifecycle management module for the babysitter-codex harness.
 * Wraps all 8 babysitter CLI session commands using execFileSync.
 */

const { execFileSync } = require('child_process');

const BABYSITTER_BIN = 'babysitter';
const DEFAULT_ENCODING = 'utf8';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Execute a babysitter CLI command and return parsed JSON output.
 *
 * @param {string[]} args - CLI arguments to pass after the babysitter binary.
 * @param {object} [execOptions] - Optional overrides for execFileSync options.
 * @returns {object} Parsed JSON result from stdout.
 * @throws {Error} If the command fails or output cannot be parsed.
 */
function runBabysitter(args, execOptions) {
  const options = Object.assign(
    {
      encoding: DEFAULT_ENCODING,
      timeout: DEFAULT_TIMEOUT_MS,
    },
    execOptions || {}
  );

  let stdout;
  try {
    stdout = execFileSync(BABYSITTER_BIN, args, options);
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const message =
      `babysitter command failed: ${BABYSITTER_BIN} ${args.join(' ')}\n` +
      `Exit code: ${err.status !== undefined ? err.status : 'unknown'}\n` +
      (stderr ? `Stderr: ${stderr}` : '');
    const wrapped = new Error(message);
    wrapped.originalError = err;
    wrapped.stderr = stderr;
    wrapped.exitCode = err.status;
    throw wrapped;
  }

  try {
    return JSON.parse(stdout);
  } catch (parseErr) {
    const message =
      `Failed to parse JSON from babysitter output.\n` +
      `Command: ${BABYSITTER_BIN} ${args.join(' ')}\n` +
      `Raw output: ${String(stdout).trim()}`;
    const wrapped = new Error(message);
    wrapped.originalError = parseErr;
    wrapped.rawOutput = stdout;
    throw wrapped;
  }
}

/**
 * 1. initSession(options)
 *
 * Initializes a new babysitter session.
 *
 * CLI: babysitter session:init --session-id <id> --state-dir <dir> --json
 *
 * @param {object} options
 * @param {string} options.sessionId - The session identifier.
 * @param {string} options.stateDir  - Directory where session state is stored.
 * @returns {object} Parsed JSON response.
 */
function initSession(options) {
  if (!options || !options.sessionId) {
    throw new Error('initSession: options.sessionId is required');
  }
  if (!options.stateDir) {
    throw new Error('initSession: options.stateDir is required');
  }

  const args = [
    'session:init',
    '--session-id', options.sessionId,
    '--state-dir', options.stateDir,
    '--json',
  ];

  return runBabysitter(args);
}

/**
 * 2. associateSession(runId)
 *
 * Associates the current session with a run ID.
 *
 * CLI: babysitter session:associate --run-id <runId> --json
 *
 * @param {string} runId - The run identifier to associate.
 * @returns {object} Parsed JSON response.
 */
function associateSession(runId) {
  if (!runId) {
    throw new Error('associateSession: runId is required');
  }

  const args = [
    'session:associate',
    '--run-id', runId,
    '--json',
  ];

  return runBabysitter(args);
}

/**
 * 3. resumeSession(sessionId, runId, options)
 *
 * Resumes an existing session.
 *
 * CLI: babysitter session:resume --session-id <id> --run-id <runId> --runs-dir <dir> --json
 *
 * @param {string} sessionId - The session identifier to resume.
 * @param {string} runId     - The run identifier.
 * @param {object} options
 * @param {string} options.runsDir - Directory containing run data.
 * @returns {object} Parsed JSON response.
 */
function resumeSession(sessionId, runId, options) {
  if (!sessionId) {
    throw new Error('resumeSession: sessionId is required');
  }
  if (!runId) {
    throw new Error('resumeSession: runId is required');
  }
  if (!options || !options.runsDir) {
    throw new Error('resumeSession: options.runsDir is required');
  }

  const args = [
    'session:resume',
    '--session-id', sessionId,
    '--run-id', runId,
    '--runs-dir', options.runsDir,
    '--json',
  ];

  return runBabysitter(args);
}

/**
 * 4. getSessionState()
 *
 * Retrieves the current session state.
 *
 * CLI: babysitter session:state --json
 *
 * @returns {object} Parsed JSON response representing current session state.
 */
function getSessionState() {
  const args = [
    'session:state',
    '--json',
  ];

  return runBabysitter(args);
}

/**
 * 5. updateSession(fields)
 *
 * Updates session fields such as iteration counter and last-iteration timestamp.
 *
 * CLI: babysitter session:update --iteration <n> --last-iteration-at <iso> --json
 *
 * @param {object} fields
 * @param {number} [fields.iteration]       - The current iteration number.
 * @param {string} [fields.lastIterationAt] - ISO 8601 timestamp of the last iteration.
 * @returns {object} Parsed JSON response.
 */
function updateSession(fields) {
  if (!fields || (fields.iteration === undefined && !fields.lastIterationAt)) {
    throw new Error(
      'updateSession: at least one of fields.iteration or fields.lastIterationAt is required'
    );
  }

  const args = ['session:update'];

  if (fields.iteration !== undefined) {
    args.push('--iteration', String(fields.iteration));
  }
  if (fields.lastIterationAt) {
    args.push('--last-iteration-at', fields.lastIterationAt);
  }

  args.push('--json');

  return runBabysitter(args);
}

/**
 * 6. checkIteration()
 *
 * Checks the current iteration status.
 *
 * CLI: babysitter session:check-iteration --json
 *
 * @returns {object} Parsed JSON response with iteration check result.
 */
function checkIteration() {
  const args = [
    'session:check-iteration',
    '--json',
  ];

  return runBabysitter(args);
}

/**
 * 7. getIterationMessage(iteration, runId, options)
 *
 * Retrieves the message for a specific iteration.
 *
 * CLI: babysitter session:iteration-message --iteration <n> --run-id <runId>
 *       --runs-dir <dir> --plugin-root <root> --json
 *
 * @param {number} iteration  - The iteration number.
 * @param {string} runId      - The run identifier.
 * @param {object} options
 * @param {string} options.runsDir    - Directory containing run data.
 * @param {string} options.pluginRoot - Root directory of the plugin.
 * @returns {object} Parsed JSON response containing the iteration message.
 */
function getIterationMessage(iteration, runId, options) {
  if (iteration === undefined || iteration === null) {
    throw new Error('getIterationMessage: iteration is required');
  }
  if (!runId) {
    throw new Error('getIterationMessage: runId is required');
  }
  if (!options || !options.runsDir) {
    throw new Error('getIterationMessage: options.runsDir is required');
  }
  if (!options.pluginRoot) {
    throw new Error('getIterationMessage: options.pluginRoot is required');
  }

  const args = [
    'session:iteration-message',
    '--iteration', String(iteration),
    '--run-id', runId,
    '--runs-dir', options.runsDir,
    '--plugin-root', options.pluginRoot,
    '--json',
  ];

  return runBabysitter(args);
}

/**
 * 8. getLastMessage(transcriptPath)
 *
 * Retrieves the last message from a transcript file.
 *
 * CLI: babysitter session:last-message --transcript-path <path> --json
 *
 * @param {string} transcriptPath - Absolute path to the transcript file.
 * @returns {object} Parsed JSON response containing the last message.
 */
function getLastMessage(transcriptPath) {
  if (!transcriptPath) {
    throw new Error('getLastMessage: transcriptPath is required');
  }

  const args = [
    'session:last-message',
    '--transcript-path', transcriptPath,
    '--json',
  ];

  return runBabysitter(args);
}

module.exports = {
  initSession,
  associateSession,
  resumeSession,
  getSessionState,
  updateSession,
  checkIteration,
  getIterationMessage,
  getLastMessage,
};
