/**
 * iteration-guard.js
 * Comprehensive standalone module for runaway detection and iteration guards
 * in the Codex orchestration loop.
 *
 * Exports (CommonJS):
 *   checkIterationGuard(runDir, options)
 *   checkTimeGuard(runDir, options)
 *   checkCostGuard(runDir, options)
 *   checkStallGuard(runDir, options)
 *   runAllGuards(runDir, options)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readSessionContext } = require('./hooks/utils.js');

// ---------------------------------------------------------------------------
// Constants / defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ITERATIONS = 10;
const ITERATION_WARN_RATIO = 0.8; // warn at 80% of max

const DEFAULT_TIMEOUT_MS = 3600000; // 1 hour in milliseconds
const TIME_HARD_STOP_MULTIPLIER = 2; // hard stop at 2x timeout

const STALL_WINDOW = 3;       // number of consecutive scores to check
const STALL_DELTA = 1.0;      // scores must differ by less than this to be "stalled"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely read and parse a JSON file.
 * Returns parsed object on success, null on any error.
 */
function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Ensure a directory exists (mkdir -p).
 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Atomically write JSON to filePath by writing to a .tmp file then renaming.
 */
function writeJsonAtomic(filePath, data) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// 1. checkIterationGuard
// ---------------------------------------------------------------------------

/**
 * Read current iteration from <runDir>/state/iteration-count.json,
 * increment it atomically, then evaluate against the configured limit.
 *
 * @param {string} runDir - Path to the run directory (e.g. .a5c/runs/<runId>)
 * @param {object} [options]
 * @param {number} [options.maxIterations] - Override max iterations
 * @param {string} [options.repoRoot] - Repository root for session context
 * @returns {Promise<{ allowed: boolean, current: number, max: number, warning: string|null }>}
 */
async function checkIterationGuard(runDir, options) {
  if (!options) options = {};
  const stateDir = path.join(runDir, 'state');
  ensureDir(stateDir);

  const countFile = path.join(stateDir, 'iteration-count.json');

  // Read current count (create with 0 if missing)
  let stored = readJsonFile(countFile);
  if (!stored || typeof stored.count !== 'number') {
    stored = { count: 0 };
  }

  // Increment
  const current = stored.count + 1;

  // Enrich with session context if available
  const session = readSessionContext(options.repoRoot);
  const writeData = { count: current, updatedAt: new Date().toISOString() };
  if (session && session.sessionId) {
    writeData.sessionId = session.sessionId;
  }

  // Write updated count atomically
  writeJsonAtomic(countFile, writeData);

  // Determine limit
  const envMax = parseInt(process.env.BABYSITTER_MAX_ITERATIONS || '', 10);
  const max = (options.maxIterations && options.maxIterations > 0)
    ? options.maxIterations
    : (!isNaN(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_ITERATIONS);

  const warnAt = Math.ceil(max * ITERATION_WARN_RATIO);

  let warning = null;
  let allowed = true;

  if (current >= max) {
    allowed = false;
    warning = `Iteration limit reached: ${current}/${max}. Halting orchestration loop.`;
  } else if (current >= warnAt) {
    warning = `Approaching iteration limit: ${current}/${max} (${Math.round((current / max) * 100)}%). Consider wrapping up.`;
  }

  return { allowed, current, max, warning };
}

// ---------------------------------------------------------------------------
// 2. checkTimeGuard
// ---------------------------------------------------------------------------

/**
 * Compare elapsed time since run start against the configured timeout.
 *
 * @param {string} runDir
 * @param {object} [options]
 * @param {number} [options.timeout] - Timeout in ms (overrides env)
 * @returns {Promise<{ allowed: boolean, elapsed: number, timeout: number, warning: string|null }>}
 */
async function checkTimeGuard(runDir, options) {
  if (!options) options = {};
  const stateDir = path.join(runDir, 'state');

  // Determine timeout
  const envTimeout = parseInt(process.env.BABYSITTER_TIMEOUT || '', 10);
  const timeout = (options.timeout && options.timeout > 0)
    ? options.timeout
    : (!isNaN(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);

  const hardStop = timeout * TIME_HARD_STOP_MULTIPLIER;

  // Attempt to read start time from multiple locations / field names
  let startTime = null;

  const stateFile = path.join(stateDir, 'state.json');
  const stateData = readJsonFile(stateFile);
  if (stateData) {
    const raw =
      stateData.startTime ||
      stateData.start_time ||
      stateData.startedAt ||
      stateData.created_at ||
      stateData.createdAt ||
      null;
    if (raw) {
      const parsed = new Date(raw).getTime();
      if (!isNaN(parsed)) startTime = parsed;
    }
  }

  if (startTime === null) {
    const manifestFile = path.join(runDir, 'manifest.json');
    const manifestData = readJsonFile(manifestFile);
    if (manifestData) {
      const raw =
        manifestData.startTime ||
        manifestData.start_time ||
        manifestData.startedAt ||
        manifestData.created_at ||
        manifestData.createdAt ||
        null;
      if (raw) {
        const parsed = new Date(raw).getTime();
        if (!isNaN(parsed)) startTime = parsed;
      }
    }
  }

  // If we still cannot determine start time, allow but warn
  if (startTime === null) {
    return {
      allowed: true,
      elapsed: 0,
      timeout,
      warning: 'Could not determine run start time; time guard skipped.',
    };
  }

  const now = Date.now();
  const elapsed = now - startTime;

  let warning = null;
  let allowed = true;

  if (elapsed >= hardStop) {
    allowed = false;
    warning = `Hard time limit exceeded: elapsed ${Math.round(elapsed / 1000)}s >= ${Math.round(hardStop / 1000)}s (2x timeout). Halting.`;
  } else if (elapsed >= timeout) {
    warning = `Timeout threshold reached: elapsed ${Math.round(elapsed / 1000)}s >= ${Math.round(timeout / 1000)}s. Wrapping up soon.`;
  }

  return { allowed, elapsed, timeout, warning };
}

// ---------------------------------------------------------------------------
// 3. checkCostGuard
// ---------------------------------------------------------------------------

/**
 * Read token usage and warn if projected exceeds threshold.
 *
 * @param {string} runDir
 * @param {object} [options]
 * @param {number} [options.maxCost] - Max token cost threshold
 * @param {number} [options.maxIterations] - Used for projection
 * @returns {Promise<{ allowed: boolean, totalTokens: number, projected: number, warning: string|null }>}
 */
async function checkCostGuard(runDir, options) {
  if (!options) options = {};
  const stateDir = path.join(runDir, 'state');
  const tokenFile = path.join(stateDir, 'token-usage.json');

  // Determine limits
  const envMax = parseInt(process.env.BABYSITTER_MAX_COST || '', 10);
  const maxCost = (options.maxCost && options.maxCost > 0)
    ? options.maxCost
    : (!isNaN(envMax) && envMax > 0 ? envMax : null);

  const envMaxIter = parseInt(process.env.BABYSITTER_MAX_ITERATIONS || '', 10);
  const maxIterations = (options.maxIterations && options.maxIterations > 0)
    ? options.maxIterations
    : (!isNaN(envMaxIter) && envMaxIter > 0 ? envMaxIter : DEFAULT_MAX_ITERATIONS);

  // Read token usage log
  const rawData = readJsonFile(tokenFile);
  let usageArray = [];

  if (Array.isArray(rawData)) {
    usageArray = rawData.map(function (entry) {
      if (typeof entry === 'number') return entry;
      if (entry && typeof entry === 'object') {
        return (
          entry.total ||
          entry.tokens ||
          entry.count ||
          (entry.input || 0) + (entry.output || 0) ||
          0
        );
      }
      return 0;
    }).filter(function (n) { return typeof n === 'number' && !isNaN(n); });
  }

  const totalTokens = usageArray.reduce(function (sum, n) { return sum + n; }, 0);
  const iterationsRun = usageArray.length;

  // Project total: average per iteration * max iterations
  let projected = totalTokens;
  if (iterationsRun > 0 && maxIterations > iterationsRun) {
    const avgPerIter = totalTokens / iterationsRun;
    const remainingIters = maxIterations - iterationsRun;
    projected = totalTokens + avgPerIter * remainingIters;
  }

  let warning = null;
  let allowed = true;

  if (maxCost !== null) {
    if (totalTokens >= maxCost) {
      allowed = false;
      warning = `Token cost limit exceeded: ${totalTokens} tokens used >= limit of ${maxCost}. Halting.`;
    } else if (projected > maxCost) {
      warning = `Projected token usage (${Math.round(projected)}) exceeds limit (${maxCost}). Current: ${totalTokens}.`;
    }
  }

  return { allowed, totalTokens, projected: Math.round(projected), warning };
}

// ---------------------------------------------------------------------------
// 4. checkStallGuard
// ---------------------------------------------------------------------------

/**
 * Detect quality plateau in recent scores.
 *
 * @param {string} runDir
 * @param {object} [options]
 * @param {number} [options.stallWindow] - Number of scores to check (default 3)
 * @param {number} [options.stallDelta] - Max variance to be considered stalled (default 1.0)
 * @returns {Promise<{ allowed: boolean, stalled: boolean, scores: number[], warning: string|null }>}
 */
async function checkStallGuard(runDir, options) {
  if (!options) options = {};
  const stateDir = path.join(runDir, 'state');
  const scoresFile = path.join(stateDir, 'quality-scores.json');

  const stallWindow = (options.stallWindow && options.stallWindow > 0)
    ? options.stallWindow
    : STALL_WINDOW;

  const stallDelta = (typeof options.stallDelta === 'number')
    ? options.stallDelta
    : STALL_DELTA;

  const rawData = readJsonFile(scoresFile);
  let scores = [];

  if (Array.isArray(rawData)) {
    scores = rawData
      .map(function (entry) {
        if (typeof entry === 'number') return entry;
        if (entry && typeof entry === 'object') {
          return entry.score != null ? entry.score : (entry.value != null ? entry.value : (entry.quality != null ? entry.quality : null));
        }
        return null;
      })
      .filter(function (n) { return n !== null && typeof n === 'number' && !isNaN(n); });
  }

  // Need at least stallWindow scores to detect stall
  if (scores.length < stallWindow) {
    return {
      allowed: true,
      stalled: false,
      scores,
      warning: scores.length === 0
        ? 'No quality scores available; stall guard skipped.'
        : null,
    };
  }

  const window = scores.slice(-stallWindow);
  const maxScore = Math.max.apply(null, window);
  const minScore = Math.min.apply(null, window);
  const spread = maxScore - minScore;

  const stalled = spread < stallDelta;

  let warning = null;
  let allowed = true;

  if (stalled) {
    allowed = false;
    warning = `Quality plateau detected: last ${stallWindow} scores [${window.join(', ')}] spread=${spread.toFixed(3)} < threshold=${stallDelta}. Run appears stalled.`;
  }

  return { allowed, stalled, scores, warning };
}

// ---------------------------------------------------------------------------
// 5. runAllGuards
// ---------------------------------------------------------------------------

/**
 * Run all four guards in parallel and return a combined result.
 *
 * @param {string} runDir
 * @param {object} [options] - Passed through to each individual guard
 * @returns {Promise<{ allowed: boolean, guards: object, warnings: string[] }>}
 */
async function runAllGuards(runDir, options) {
  if (!options) options = {};

  const results = await Promise.all([
    checkIterationGuard(runDir, options).catch(function (err) {
      return {
        allowed: true,
        current: 0,
        max: DEFAULT_MAX_ITERATIONS,
        warning: 'checkIterationGuard error: ' + err.message,
      };
    }),
    checkTimeGuard(runDir, options).catch(function (err) {
      return {
        allowed: true,
        elapsed: 0,
        timeout: DEFAULT_TIMEOUT_MS,
        warning: 'checkTimeGuard error: ' + err.message,
      };
    }),
    checkCostGuard(runDir, options).catch(function (err) {
      return {
        allowed: true,
        totalTokens: 0,
        projected: 0,
        warning: 'checkCostGuard error: ' + err.message,
      };
    }),
    checkStallGuard(runDir, options).catch(function (err) {
      return {
        allowed: true,
        stalled: false,
        scores: [],
        warning: 'checkStallGuard error: ' + err.message,
      };
    }),
  ]);

  const iteration = results[0];
  const time = results[1];
  const cost = results[2];
  const stall = results[3];

  const guards = { iteration, time, cost, stall };

  // Collect all non-null warnings
  const warnings = Object.values(guards)
    .map(function (g) { return g.warning; })
    .filter(function (w) { return w !== null && w !== undefined; });

  // Overall allowed only if every guard permits
  const allowed = iteration.allowed && time.allowed && cost.allowed && stall.allowed;

  return { allowed, guards, warnings };
}

module.exports = {
  checkIterationGuard,
  checkTimeGuard,
  checkCostGuard,
  checkStallGuard,
  runAllGuards,
  readSessionContext,
};
