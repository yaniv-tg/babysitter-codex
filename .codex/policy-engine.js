'use strict';

function shouldBlockPlanAction(mode, kind) {
  if (mode !== 'plan') return false;
  return kind === 'agent' || kind === 'shell' || kind === 'node';
}

function applyApprovalPolicy(task, context = {}) {
  const policy = context.policy || 'interactive';
  if (task.kind !== 'breakpoint') return { approved: true, reason: 'not_breakpoint' };
  if (policy === 'auto-approve') return { approved: true, reason: 'auto_approve' };
  return { approved: null, reason: 'interactive_required' };
}

function nextRetryDelayMs(attempt) {
  const n = Math.max(1, Number(attempt || 1));
  return Math.min(30000, 1000 * Math.pow(2, n - 1));
}

module.exports = {
  shouldBlockPlanAction,
  applyApprovalPolicy,
  nextRetryDelayMs,
};
