'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLI = 'babysitter';
const BABYSITTER_PKG = '@a5c-ai/babysitter-sdk@0.0.173';

/**
 * Run a babysitter CLI sub-command via npx and return parsed JSON output.
 * @param {string[]} subArgs - Arguments to pass after the package name
 * @returns {Object|null} Parsed JSON result or null on error
 */
function runBabysitter(subArgs) {
  const cmdArgs = ['-y', BABYSITTER_PKG, ...subArgs];
  let raw;
  try {
    raw = execFileSync('npx', cmdArgs, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  } catch (err) {
    const stderr = (err.stderr || '').toString().trim();
    const stdout = (err.stdout || '').toString().trim();
    console.error(`[discovery] babysitter command failed:\n  cmd: npx ${cmdArgs.join(' ')}\n  stderr: ${stderr}\n  stdout: ${stdout}`);
    return null;
  }

  // Strip ANSI escape codes
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();

  // Extract first JSON object or array from output (ignore surrounding log lines)
  const jsonMatch = clean.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!jsonMatch) {
    console.error(`[discovery] No JSON found in babysitter output:\n${clean}`);
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error(`[discovery] Failed to parse JSON from babysitter output: ${parseErr.message}\nRaw:\n${clean}`);
    return null;
  }
}

/**
 * Discover available skills, agents, and processes.
 * @param {Object} options
 * @param {string} [options.pluginRoot] - Plugin root directory
 * @param {string} [options.runsDir] - Runs directory
 * @param {number} [options.cacheTtl] - Cache TTL in seconds
 * @param {boolean} [options.includeRemote] - Include remote sources
 * @param {boolean} [options.summaryOnly] - Summary only
 * @param {string} [options.processPath] - Process file for targeted discovery via @skill/@agent markers
 * @returns {Object|null} Discovery results or null on error
 */
function discoverSkills(options = {}) {
  const args = ['skill:discover', '--json'];

  if (options.pluginRoot) {
    args.push('--plugin-root', options.pluginRoot);
  }

  if (options.runsDir) {
    args.push('--runs-dir', options.runsDir);
  }

  if (options.cacheTtl !== undefined && options.cacheTtl !== null) {
    args.push('--cache-ttl', String(options.cacheTtl));
  }

  if (options.includeRemote) {
    args.push('--include-remote');
  }

  if (options.summaryOnly) {
    args.push('--summary-only');
  }

  if (options.processPath) {
    args.push('--process-path', options.processPath);
  }

  return runBabysitter(args);
}

/**
 * Fetch skills from remote sources.
 * @param {string} sourceType - 'github' or 'well-known'
 * @param {string} url - Source URL
 * @returns {Object|null} Fetched skills or null on error
 */
function fetchRemoteSkills(sourceType, url) {
  if (!sourceType || !url) {
    console.error('[discovery] fetchRemoteSkills: sourceType and url are required');
    return null;
  }

  const args = [
    'skill:fetch-remote',
    '--source-type', sourceType,
    '--url', url,
    '--json',
  ];

  return runBabysitter(args);
}

/**
 * Parse @skill and @agent JSDoc markers from a process file.
 * @param {string} filePath - Path to the process JS file
 * @returns {{ skills: Array, agents: Array }} Parsed markers
 */
function parseProcessMarkers(filePath) {
  const result = { skills: [], agents: [] };

  if (!filePath) {
    console.error('[discovery] parseProcessMarkers: filePath is required');
    return result;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (readErr) {
    console.error(`[discovery] parseProcessMarkers: failed to read file "${filePath}": ${readErr.message}`);
    return result;
  }

  // Match @skill and @agent JSDoc tags in the form:
  //   @skill name [optional/path]
  //   @agent name [optional/path]
  // These may appear inside block comments (/** ... */) or line comments (//)
  //
  // Patterns to handle:
  //   * @skill mySkillName
  //   * @skill mySkillName ./path/to/skill
  //   // @skill mySkillName
  //   // @agent myAgentName ./agents/myAgent
  const markerRegex = /(?:\/\/|[\*\s]+)\s*@(skill|agent)\s+(\S+)(?:\s+(\S+))?/g;

  let match;
  while ((match = markerRegex.exec(content)) !== null) {
    const kind = match[1];      // 'skill' or 'agent'
    const name = match[2];      // marker name
    const markerPath = match[3] || null; // optional path (may be undefined)

    const entry = { name };
    if (markerPath) {
      // Resolve path relative to the directory containing the process file
      entry.path = path.resolve(path.dirname(filePath), markerPath);
    }

    if (kind === 'skill') {
      result.skills.push(entry);
    } else if (kind === 'agent') {
      result.agents.push(entry);
    }
  }

  return result;
}

module.exports = { discoverSkills, fetchRemoteSkills, parseProcessMarkers };
