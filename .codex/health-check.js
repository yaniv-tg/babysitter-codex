'use strict';
const { execFileSync } = require('child_process');

const CLI = 'babysitter';

/**
 * Run SDK health check.
 * @param {boolean} [verbose=false] - Include verbose output
 * @returns {Object} Health status with overall status and per-check details
 */
function checkHealth(verbose) {
  const args = ['health', '--json'];
  if (verbose) args.push('--verbose');
  try {
    const result = execFileSync(CLI, args, { encoding: 'utf8', timeout: 15000 });
    return JSON.parse(result);
  } catch (err) {
    return { status: 'unhealthy', error: err.message };
  }
}

/**
 * Show current effective configuration.
 * Runs: babysitter configure show --json
 * @returns {Object} Parsed configuration object, or error descriptor on failure.
 */
function showConfig() {
  try {
    const result = execFileSync(CLI, ['configure', 'show', '--json'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Validate current configuration.
 * Runs: babysitter configure validate --json
 * @returns {Object} Validation result object with a `valid` boolean and any
 *                   `errors` / `warnings` arrays, or an error descriptor on
 *                   failure.
 */
function validateConfig() {
  try {
    const result = execFileSync(CLI, ['configure', 'validate', '--json'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    // A non-zero exit (invalid config) still emits JSON on stdout in many CLI
    // implementations.  Try to extract it from the combined error output before
    // falling back to the plain error message.
    const raw = (err.stdout || '').toString().trim();
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (_) {
        // fall through
      }
    }
    return { valid: false, error: err.message };
  }
}

/**
 * Show all important paths used by the SDK.
 * Runs: babysitter configure paths --json
 * @returns {Object} Parsed paths object (e.g. configDir, logsDir, runsDir, …),
 *                   or an error descriptor on failure.
 */
function showPaths() {
  try {
    const result = execFileSync(CLI, ['configure', 'paths', '--json'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Run startup health gate — returns true if healthy/degraded, false if unhealthy.
 * @param {boolean} [verbose=false] - Pass --verbose to the health check
 * @returns {boolean} true when the SDK is healthy or degraded, false when unhealthy.
 */
function runStartupHealthGate(verbose) {
  const health = checkHealth(verbose);
  if (health.status === 'unhealthy') {
    console.error('[health-check] SDK is unhealthy:', JSON.stringify(health));
    return false;
  }
  if (health.status === 'degraded') {
    console.warn('[health-check] SDK is degraded:', JSON.stringify(health));
  }
  return true;
}

module.exports = { checkHealth, showConfig, validateConfig, showPaths, runStartupHealthGate };
