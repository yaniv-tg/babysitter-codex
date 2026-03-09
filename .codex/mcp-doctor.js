'use strict';

const fs = require('fs');
const path = require('path');

function checkPath(value) {
  if (!value) return { ok: false, reason: 'missing' };
  return { ok: fs.existsSync(value), reason: fs.existsSync(value) ? 'ok' : 'not_found' };
}

function runMcpDoctor(repoRoot) {
  const root = repoRoot || process.cwd();
  const checks = [];

  checks.push({
    name: 'mcp_config_file',
    ...checkPath(path.join(root, '.codex', 'config.toml')),
  });

  checks.push({
    name: 'oauth_env_present',
    ok: Boolean(process.env.MCP_OAUTH_CLIENT_ID || process.env.BABYSITTER_MCP_OAUTH_CLIENT_ID),
    reason: process.env.MCP_OAUTH_CLIENT_ID || process.env.BABYSITTER_MCP_OAUTH_CLIENT_ID ? 'ok' : 'missing',
  });

  checks.push({
    name: 'transport_env_present',
    ok: Boolean(process.env.MCP_TRANSPORT || process.env.BABYSITTER_MCP_TRANSPORT),
    reason: process.env.MCP_TRANSPORT || process.env.BABYSITTER_MCP_TRANSPORT ? 'ok' : 'missing',
  });

  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    checks,
    failedCount: failed.length,
  };
}

module.exports = {
  runMcpDoctor,
};
